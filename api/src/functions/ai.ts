import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getContainer } from '../db';
import { Incident } from '../types';
import { jsonResponse, errorResponse } from '../utils';

// Groq API - Free, fast, reliable
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callGroq(messages: ChatMessage[]): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error('AI is not configured. Please add GROQ_API_KEY to the function app settings.');
  }

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
    throw new Error(`AI service error: ${errorMsg}`);
  }

  const data = await response.json();
  
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI returned an empty response. Please try again.');
  }
  
  return content.trim();
}

// Helper to format date for AI prompts in the user's timezone
function formatDateForAI(isoString: string, timezone?: string): string {
  const date = new Date(isoString);
  
  // Use the user's timezone if provided, otherwise fall back to UTC
  const tz = timezone || 'UTC';
  
  try {
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: tz
    });
    
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: tz
    });
    
    return `${dateStr} at ${timeStr}`;
  } catch {
    // Fallback if timezone is invalid
    return date.toLocaleString('en-US');
  }
}

// Interface for timezone info from frontend
interface TimezoneInfo {
  timezone?: string;
  timezoneOffset?: number;
}

// ─── Generate Summary from Timeline ──────────────────────────────────────────
app.http('generateSummary', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'incidents/{id}/ai/summary',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const id = req.params.id!;
    const container = getContainer();
    
    // Get timezone from request body
    let timezone: string | undefined;
    try {
      const body = await req.json() as TimezoneInfo;
      timezone = body.timezone;
    } catch {
      // No body or invalid JSON - use UTC
    }
    
    try {
      const { resource: incident } = await container.item(id, 'default').read<Incident>();
      if (!incident) return errorResponse('Incident not found', 404);

      if (incident.timeline.length === 0) {
        return errorResponse('Add at least one timeline event before generating a summary', 400);
      }

      const timelineText = incident.timeline
        .map(e => `- ${formatDateForAI(e.timestamp, timezone)}: ${e.description} (by ${e.author})`)
        .join('\n');

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are an expert Site Reliability Engineer writing incident postmortem summaries. Be concise, professional, and blameless. Write 2-3 paragraphs. Do not use markdown formatting or headers.'
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

      const summary = await callGroq(messages);
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
          content: 'You are an expert Site Reliability Engineer. You must respond with ONLY a JSON array of strings containing action items. No other text, no explanation, no markdown - just the JSON array.'
        },
        {
          role: 'user',
          content: `Suggest 4 follow-up action items for this incident:

Incident: ${incident.title}
Severity: ${incident.severity}
Services: ${incident.servicesImpacted.join(', ') || 'Not specified'}
Summary: ${incident.summary || 'No summary'}

${existingActions ? `Already planned (do not repeat these):\n${existingActions}` : ''}

Respond with ONLY a JSON array like: ["Add monitoring for X", "Create runbook for Y", "Review Z", "Implement W"]`
        }
      ];

      const response = await callGroq(messages);
      
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
    
    // Get timezone from request body
    let timezone: string | undefined;
    try {
      const body = await req.json() as TimezoneInfo;
      timezone = body.timezone;
    } catch {
      // No body or invalid JSON - use UTC
    }
    
    try {
      const { resource: incident } = await container.item(id, 'default').read<Incident>();
      if (!incident) return errorResponse('Incident not found', 404);

      const timelineText = incident.timeline.length > 0
        ? incident.timeline.map(e => `- ${formatDateForAI(e.timestamp, timezone)}: ${e.description} (${e.author})`).join('\n')
        : 'No timeline recorded';

      const actionsText = incident.actionItems.length > 0
        ? incident.actionItems.map(a => `- [${a.status === 'done' ? 'x' : ' '}] ${a.title} (Owner: ${a.owner})`).join('\n')
        : 'No action items';

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are an expert Site Reliability Engineer writing comprehensive incident postmortem reports. Use proper Markdown formatting with headers. When referencing times, use the exact timestamps provided - do not modify them.'
        },
        {
          role: 'user',
          content: `Write a complete postmortem report for this incident:

Title: ${incident.title}
Severity: ${incident.severity}
Status: ${incident.status}
Started: ${formatDateForAI(incident.startedAt, timezone)}
Resolved: ${incident.resolvedAt ? formatDateForAI(incident.resolvedAt, timezone) : 'Ongoing'}
Services: ${incident.servicesImpacted.join(', ') || 'Not specified'}
Summary: ${incident.summary || 'Not provided'}

Timeline:
${timelineText}

Action Items:
${actionsText}

Write a professional Markdown postmortem with these sections:
# Executive Summary
## Impact  
## Root Cause Analysis
## Timeline
## Action Items
## Lessons Learned

IMPORTANT: Use the exact timestamps provided above. Do not change or adjust the times.`
        }
      ];

      const report = await callGroq(messages);
      return jsonResponse({ report });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI generation failed';
      return errorResponse(message, 500);
    }
  },
});
