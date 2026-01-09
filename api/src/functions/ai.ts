import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getContainer } from '../db';
import { Incident } from '../types';
import { jsonResponse, errorResponse } from '../utils';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${err}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ─── Generate Summary from Timeline ──────────────────────────────────────────
app.http('generateSummary', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'incidents/{id}/ai/summary',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const id = req.params.id!;
    const container = getContainer();
    
    try {
      const { resource: incident } = await container.item(id, 'default').read<Incident>();
      if (!incident) return errorResponse('Incident not found', 404);

      if (incident.timeline.length === 0) {
        return errorResponse('Add timeline events first to generate a summary');
      }

      const timelineText = incident.timeline
        .map(e => `- ${e.timestamp}: ${e.description} (${e.author})`)
        .join('\n');

      const prompt = `You are an expert Site Reliability Engineer writing an incident postmortem summary.

Given this incident:
- Title: ${incident.title}
- Severity: ${incident.severity}
- Status: ${incident.status}
- Services Impacted: ${incident.servicesImpacted.join(', ') || 'Unknown'}

Timeline of events:
${timelineText}

Write a concise, professional incident summary (2-3 paragraphs) that:
1. Describes what happened and the impact
2. Explains the root cause (if identifiable from timeline)
3. Notes the resolution and recovery

Use a blameless, factual tone. Do not use markdown formatting.`;

      const summary = await callGemini(prompt);
      return jsonResponse({ summary: summary.trim() });
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'AI generation failed', 500);
    }
  },
});

// ─── Suggest Action Items ────────────────────────────────────────────────────
app.http('suggestActions', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'incidents/{id}/ai/actions',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const id = req.params.id!;
    const container = getContainer();
    
    try {
      const { resource: incident } = await container.item(id, 'default').read<Incident>();
      if (!incident) return errorResponse('Incident not found', 404);

      const existingActions = incident.actionItems.map(a => a.title).join(', ');
      const timelineText = incident.timeline
        .map(e => `- ${e.description}`)
        .join('\n');

      const prompt = `You are an expert Site Reliability Engineer suggesting follow-up action items after an incident.

Incident:
- Title: ${incident.title}
- Severity: ${incident.severity}
- Services: ${incident.servicesImpacted.join(', ') || 'Unknown'}
- Summary: ${incident.summary || 'Not provided'}

Timeline:
${timelineText || 'No timeline events'}

Existing action items: ${existingActions || 'None'}

Suggest 3-5 specific, actionable follow-up items to prevent similar incidents. Focus on:
- Monitoring and alerting improvements
- Automation opportunities
- Documentation updates
- Process improvements
- Technical fixes

Return ONLY a JSON array of strings, each being a suggested action item title. Example:
["Add latency alerting for payment service", "Document rollback procedure"]`;

      const response = await callGemini(prompt);
      
      // Parse JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return jsonResponse({ suggestions: [] });
      }
      
      const suggestions = JSON.parse(jsonMatch[0]);
      return jsonResponse({ suggestions });
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'AI generation failed', 500);
    }
  },
});

// ─── Generate Full Report ────────────────────────────────────────────────────
app.http('generateReport', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'incidents/{id}/ai/report',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const id = req.params.id!;
    const container = getContainer();
    
    try {
      const { resource: incident } = await container.item(id, 'default').read<Incident>();
      if (!incident) return errorResponse('Incident not found', 404);

      const timelineText = incident.timeline
        .map(e => `- ${new Date(e.timestamp).toLocaleString()}: ${e.description} (${e.author})`)
        .join('\n');

      const actionsText = incident.actionItems
        .map(a => `- [${a.status === 'done' ? 'x' : ' '}] ${a.title} (${a.owner})`)
        .join('\n');

      const prompt = `You are an expert Site Reliability Engineer writing a complete incident postmortem report.

Incident Details:
- Title: ${incident.title}
- Severity: ${incident.severity}
- Status: ${incident.status}
- Started: ${new Date(incident.startedAt).toLocaleString()}
- Resolved: ${incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString() : 'Ongoing'}
- Services Impacted: ${incident.servicesImpacted.join(', ') || 'Unknown'}
- Summary: ${incident.summary || 'Not provided'}

Timeline:
${timelineText || 'No timeline events recorded'}

Action Items:
${actionsText || 'No action items'}

Write a professional incident postmortem report in Markdown format with these sections:
1. Executive Summary (2-3 sentences)
2. Impact (who was affected, for how long)
3. Root Cause Analysis
4. Timeline (formatted nicely)
5. Action Items
6. Lessons Learned

Use a blameless, factual tone. Include the actual data from the incident.`;

      const report = await callGemini(prompt);
      return jsonResponse({ report: report.trim() });
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'AI generation failed', 500);
    }
  },
});

