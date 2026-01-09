import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getContainer } from '../db';
import { Incident } from '../types';
import { jsonResponse, errorResponse } from '../utils';

// Hugging Face free inference endpoint (new router URL, OpenAI-compatible)
const HF_URL = 'https://router.huggingface.co/novita/v3/openai/chat/completions';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callAI(messages: ChatMessage[]): Promise<string> {
  const response = await fetch(HF_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek/deepseek-r1-0528',
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    
    if (response.status === 503 || errorText.includes('loading')) {
      throw new Error('AI model is loading. Please wait 20-30 seconds and try again.');
    }
    
    throw new Error(`AI service error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`AI error: ${data.error.message || data.error}`);
  }
  
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI returned an empty response. Please try again.');
  }
  
  return content.trim();
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
        return errorResponse('Add at least one timeline event before generating a summary', 400);
      }

      const timelineText = incident.timeline
        .map(e => `- ${new Date(e.timestamp).toLocaleString()}: ${e.description} (by ${e.author})`)
        .join('\n');

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are an expert Site Reliability Engineer writing incident postmortem summaries. Be concise, professional, and blameless. Write 2-3 paragraphs without markdown formatting.'
        },
        {
          role: 'user',
          content: `Write an incident summary for:

Title: ${incident.title}
Severity: ${incident.severity}
Status: ${incident.status}
Services Affected: ${incident.servicesImpacted.join(', ') || 'Not specified'}

Timeline:
${timelineText}

Cover: what happened, the impact, root cause (if apparent from timeline), and resolution.`
        }
      ];

      const summary = await callAI(messages);
      
      if (summary.length < 20) {
        throw new Error('AI generated an incomplete response. Please try again.');
      }

      return jsonResponse({ summary });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI generation failed';
      return errorResponse(message, 500);
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

      const existingActions = incident.actionItems.map(a => `- ${a.title}`).join('\n');

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are an expert Site Reliability Engineer. Return ONLY a JSON array of strings with action items. No explanation, no markdown, just the JSON array.'
        },
        {
          role: 'user',
          content: `Suggest 4 follow-up action items for this incident:

Incident: ${incident.title}
Severity: ${incident.severity}
Services: ${incident.servicesImpacted.join(', ') || 'Not specified'}
Summary: ${incident.summary || 'No summary'}

${existingActions ? `Already planned:\n${existingActions}\n\nSuggest NEW items not listed above.` : ''}

Return ONLY a JSON array like: ["action 1", "action 2", "action 3", "action 4"]`
        }
      ];

      const response = await callAI(messages);
      
      // Parse JSON from response
      const jsonMatch = response.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) {
        throw new Error('AI did not return valid suggestions. Please try again.');
      }
      
      let suggestions: string[];
      try {
        suggestions = JSON.parse(jsonMatch[0]);
      } catch {
        throw new Error('AI returned malformed data. Please try again.');
      }

      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        throw new Error('AI did not generate any suggestions. Please try again.');
      }

      const validSuggestions = suggestions
        .filter((s): s is string => typeof s === 'string' && s.length > 0)
        .slice(0, 5);

      if (validSuggestions.length === 0) {
        throw new Error('AI suggestions were invalid. Please try again.');
      }

      return jsonResponse({ suggestions: validSuggestions });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI generation failed';
      return errorResponse(message, 500);
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

      const timelineText = incident.timeline.length > 0
        ? incident.timeline.map(e => `- ${new Date(e.timestamp).toLocaleString()}: ${e.description} (${e.author})`).join('\n')
        : 'No timeline recorded';

      const actionsText = incident.actionItems.length > 0
        ? incident.actionItems.map(a => `- [${a.status === 'done' ? 'x' : ' '}] ${a.title} (Owner: ${a.owner})`).join('\n')
        : 'No action items';

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are an expert Site Reliability Engineer writing comprehensive incident postmortem reports. Use Markdown formatting.'
        },
        {
          role: 'user',
          content: `Write a complete postmortem report:

Title: ${incident.title}
Severity: ${incident.severity}
Status: ${incident.status}
Started: ${new Date(incident.startedAt).toLocaleString()}
Resolved: ${incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString() : 'Ongoing'}
Services: ${incident.servicesImpacted.join(', ') || 'Not specified'}
Summary: ${incident.summary || 'Not provided'}

Timeline:
${timelineText}

Action Items:
${actionsText}

Write a professional Markdown report with these sections:
# Executive Summary
## Impact
## Root Cause Analysis
## Timeline
## Action Items
## Lessons Learned`
        }
      ];

      const report = await callAI(messages);
      
      if (report.length < 100) {
        throw new Error('AI generated an incomplete report. Please try again.');
      }

      return jsonResponse({ report });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI generation failed';
      return errorResponse(message, 500);
    }
  },
});
