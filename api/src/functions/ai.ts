import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getContainer } from '../db';
import { Incident } from '../types';
import { jsonResponse, errorResponse } from '../utils';

// Hugging Face free inference endpoint - using a smaller, faster model
const HF_MODEL = 'HuggingFaceH4/zephyr-7b-beta';
const HF_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

async function callHuggingFace(prompt: string): Promise<string> {
  const response = await fetch(HF_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: 512,
        temperature: 0.7,
        do_sample: true,
        return_full_text: false,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    
    // Check for model loading error
    if (response.status === 503) {
      throw new Error('AI model is loading. Please wait 20-30 seconds and try again.');
    }
    
    throw new Error(`AI service error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  
  // Handle error response
  if (data.error) {
    if (data.error.includes('loading')) {
      throw new Error('AI model is loading. Please wait 20-30 seconds and try again.');
    }
    throw new Error(`AI error: ${data.error}`);
  }
  
  // Extract generated text
  if (Array.isArray(data) && data[0]?.generated_text) {
    return data[0].generated_text.trim();
  }
  if (data.generated_text) {
    return data.generated_text.trim();
  }
  
  throw new Error('AI returned an invalid response format. Please try again.');
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

      const prompt = `<|system|>
You are an expert Site Reliability Engineer writing incident postmortem summaries. Be concise and professional.</s>
<|user|>
Write a 2-3 paragraph incident summary for:

Title: ${incident.title}
Severity: ${incident.severity}
Status: ${incident.status}
Services Affected: ${incident.servicesImpacted.join(', ') || 'Not specified'}

Timeline:
${timelineText}

Write a professional summary covering: what happened, the impact, root cause (if apparent), and resolution. No markdown formatting.</s>
<|assistant|>`;

      const summary = await callHuggingFace(prompt);
      
      if (!summary || summary.length < 20) {
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

      const prompt = `<|system|>
You are an expert Site Reliability Engineer. Suggest specific, actionable follow-up items to prevent incident recurrence.</s>
<|user|>
Incident: ${incident.title}
Severity: ${incident.severity}
Services: ${incident.servicesImpacted.join(', ') || 'Not specified'}
Summary: ${incident.summary || 'No summary provided'}

${existingActions ? `Already planned:\n${existingActions}` : ''}

Suggest exactly 4 NEW action items. Return ONLY a JSON array of strings:
["action 1", "action 2", "action 3", "action 4"]</s>
<|assistant|>`;

      const response = await callHuggingFace(prompt);
      
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

      // Filter out any non-string items and limit to 5
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

      const prompt = `<|system|>
You are an expert Site Reliability Engineer writing a comprehensive incident postmortem report in Markdown format.</s>
<|user|>
Write a complete postmortem report for:

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

Write a professional Markdown postmortem with sections:
1. # Executive Summary
2. ## Impact
3. ## Root Cause Analysis  
4. ## Timeline
5. ## Action Items
6. ## Lessons Learned</s>
<|assistant|>`;

      const report = await callHuggingFace(prompt);
      
      if (!report || report.length < 100) {
        throw new Error('AI generated an incomplete report. Please try again.');
      }

      return jsonResponse({ report });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI generation failed';
      return errorResponse(message, 500);
    }
  },
});
