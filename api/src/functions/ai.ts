import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getContainer } from '../db';
import { Incident } from '../types';
import { jsonResponse, errorResponse } from '../utils';

// Hugging Face free inference endpoint (no API key required for some models)
const HF_MODEL = 'mistralai/Mistral-7B-Instruct-v0.2';
const HF_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

async function callHuggingFace(prompt: string): Promise<string> {
  try {
    const response = await fetch(HF_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.7,
          return_full_text: false,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HF API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Handle different response formats
    if (Array.isArray(data) && data[0]?.generated_text) {
      return data[0].generated_text;
    }
    if (data.generated_text) {
      return data.generated_text;
    }
    
    throw new Error('Unexpected response format');
  } catch (err) {
    console.error('HuggingFace API failed:', err);
    throw err;
  }
}

// Fallback: Generate summary using templates (no AI needed)
function generateTemplateSummary(incident: Incident): string {
  const duration = incident.resolvedAt 
    ? Math.round((new Date(incident.resolvedAt).getTime() - new Date(incident.startedAt).getTime()) / 60000)
    : null;
  
  const services = incident.servicesImpacted.length > 0 
    ? incident.servicesImpacted.join(', ') 
    : 'multiple services';

  const severityDesc: Record<string, string> = {
    SEV1: 'critical',
    SEV2: 'major',
    SEV3: 'moderate',
    SEV4: 'minor'
  };

  let summary = `On ${new Date(incident.startedAt).toLocaleDateString()}, a ${severityDesc[incident.severity]} incident occurred affecting ${services}. `;
  
  if (incident.timeline.length > 0) {
    summary += `The incident was first detected at ${new Date(incident.timeline[0].timestamp).toLocaleTimeString()} when ${incident.timeline[0].description.toLowerCase()}. `;
    
    if (incident.timeline.length > 1) {
      const lastEvent = incident.timeline[incident.timeline.length - 1];
      summary += `After investigation, ${lastEvent.description.toLowerCase()}. `;
    }
  }

  if (duration) {
    summary += `Total incident duration was approximately ${duration} minutes. `;
  }

  if (incident.actionItems.length > 0) {
    summary += `${incident.actionItems.length} follow-up action item(s) have been identified to prevent recurrence.`;
  }

  return summary;
}

// Fallback: Generate action suggestions using templates
function generateTemplateActions(incident: Incident): string[] {
  const suggestions: string[] = [];
  
  // Based on severity
  if (incident.severity === 'SEV1' || incident.severity === 'SEV2') {
    suggestions.push('Create runbook for this incident type');
    suggestions.push('Schedule incident retrospective with stakeholders');
  }

  // Based on services
  incident.servicesImpacted.forEach(service => {
    suggestions.push(`Add monitoring alerts for ${service}`);
  });

  // Generic but useful
  suggestions.push('Update on-call documentation with lessons learned');
  suggestions.push('Review and improve alerting thresholds');
  suggestions.push('Add automated health checks for affected systems');
  
  // Dedupe and limit
  return [...new Set(suggestions)].slice(0, 5);
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

      // Try AI first, fall back to template
      let summary: string;
      
      try {
        if (incident.timeline.length === 0) {
          throw new Error('No timeline events');
        }

        const timelineText = incident.timeline
          .map(e => `- ${e.timestamp}: ${e.description}`)
          .join('\n');

        const prompt = `<s>[INST] Write a brief 2-3 sentence incident summary for this outage:

Title: ${incident.title}
Severity: ${incident.severity}
Services: ${incident.servicesImpacted.join(', ') || 'Unknown'}

Timeline:
${timelineText}

Write only the summary, no headers or formatting. Be concise and professional. [/INST]`;

        summary = await callHuggingFace(prompt);
        summary = summary.trim();
        
        // If response is too short or seems invalid, use template
        if (summary.length < 50) {
          throw new Error('Response too short');
        }
      } catch {
        // Fallback to template-based summary
        summary = generateTemplateSummary(incident);
      }

      return jsonResponse({ summary });
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Generation failed', 500);
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

      let suggestions: string[];

      try {
        const prompt = `<s>[INST] Suggest 3 specific action items to prevent this incident from happening again:

Incident: ${incident.title}
Severity: ${incident.severity}
Services affected: ${incident.servicesImpacted.join(', ') || 'Unknown'}

Return only a JSON array of strings with 3 action items. Example format:
["Action 1", "Action 2", "Action 3"] [/INST]`;

        const response = await callHuggingFace(prompt);
        
        // Try to parse JSON from response
        const jsonMatch = response.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
          if (Array.isArray(suggestions) && suggestions.length > 0) {
            return jsonResponse({ suggestions: suggestions.slice(0, 5) });
          }
        }
        throw new Error('Could not parse suggestions');
      } catch {
        // Fallback to template-based suggestions
        suggestions = generateTemplateActions(incident);
      }

      return jsonResponse({ suggestions });
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Generation failed', 500);
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

      // Generate report using templates (more reliable than AI for structured docs)
      const report = generateTemplateReport(incident);
      return jsonResponse({ report });
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Generation failed', 500);
    }
  },
});

function generateTemplateReport(inc: Incident): string {
  const duration = inc.resolvedAt 
    ? Math.round((new Date(inc.resolvedAt).getTime() - new Date(inc.startedAt).getTime()) / 60000)
    : null;

  const lines: string[] = [];
  
  lines.push(`# Incident Postmortem: ${inc.title}`);
  lines.push('');
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(`A ${inc.severity} incident occurred on ${new Date(inc.startedAt).toLocaleDateString()} affecting ${inc.servicesImpacted.join(', ') || 'multiple services'}. ${duration ? `The incident lasted approximately ${duration} minutes.` : 'The incident is ongoing.'} ${inc.actionItems.length} follow-up actions have been identified.`);
  lines.push('');
  
  lines.push('## Incident Details');
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| **Severity** | ${inc.severity} |`);
  lines.push(`| **Status** | ${inc.status} |`);
  lines.push(`| **Started** | ${new Date(inc.startedAt).toLocaleString()} |`);
  lines.push(`| **Resolved** | ${inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleString() : 'Ongoing'} |`);
  lines.push(`| **Duration** | ${duration ? `${duration} minutes` : 'Ongoing'} |`);
  lines.push(`| **Services** | ${inc.servicesImpacted.join(', ') || 'N/A'} |`);
  lines.push('');

  if (inc.summary) {
    lines.push('## Summary');
    lines.push('');
    lines.push(inc.summary);
    lines.push('');
  }

  lines.push('## Timeline');
  lines.push('');
  if (inc.timeline.length === 0) {
    lines.push('_No timeline events recorded._');
  } else {
    inc.timeline.forEach((e) => {
      const time = new Date(e.timestamp).toLocaleTimeString();
      lines.push(`- **${time}** (${e.author}): ${e.description}`);
    });
  }
  lines.push('');

  lines.push('## Action Items');
  lines.push('');
  if (inc.actionItems.length === 0) {
    lines.push('_No action items identified._');
  } else {
    inc.actionItems.forEach((a) => {
      const checkbox = a.status === 'done' ? 'x' : ' ';
      const due = a.dueDate ? ` (due ${new Date(a.dueDate).toLocaleDateString()})` : '';
      lines.push(`- [${checkbox}] ${a.title} — *${a.owner}*${due}`);
    });
  }
  lines.push('');

  lines.push('## Lessons Learned');
  lines.push('');
  lines.push('_To be completed during incident retrospective._');
  lines.push('');
  lines.push('---');
  lines.push(`*Report generated on ${new Date().toLocaleString()}*`);

  return lines.join('\n');
}
