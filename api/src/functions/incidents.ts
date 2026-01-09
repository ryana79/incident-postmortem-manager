import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getContainer } from '../db';
import {
  Incident,
  CreateIncidentSchema,
  UpdateIncidentSchema,
  CreateTimelineEventSchema,
  CreateActionItemSchema,
  TimelineEvent,
  ActionItem,
} from '../types';
import { uuid, nowISO, createAuditEntry, jsonResponse, errorResponse } from '../utils';

const TENANT_ID = 'default'; // Multi-tenant placeholder
const USER = 'anonymous'; // Replace with auth user when integrated

// ─── List Incidents ──────────────────────────────────────────────────────────
app.http('listIncidents', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'incidents',
  handler: async (_req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const container = getContainer();
    const { resources } = await container.items
      .query<Incident>({
        query: 'SELECT * FROM c WHERE c.tenantId = @tenantId ORDER BY c.createdAt DESC',
        parameters: [{ name: '@tenantId', value: TENANT_ID }],
      })
      .fetchAll();
    return jsonResponse(resources);
  },
});

// ─── Get Incident ────────────────────────────────────────────────────────────
app.http('getIncident', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'incidents/{id}',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const id = req.params.id!;
    const container = getContainer();
    try {
      const { resource } = await container.item(id, TENANT_ID).read<Incident>();
      if (!resource) return errorResponse('Not found', 404);
      return jsonResponse(resource);
    } catch {
      return errorResponse('Not found', 404);
    }
  },
});

// ─── Create Incident ─────────────────────────────────────────────────────────
app.http('createIncident', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'incidents',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const body = await req.json();
    const parsed = CreateIncidentSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.message);

    const now = nowISO();
    const incident: Incident = {
      id: uuid(),
      tenantId: TENANT_ID,
      ...parsed.data,
      timeline: [],
      actionItems: [],
      auditLog: [createAuditEntry(USER, 'created')],
      createdAt: now,
      updatedAt: now,
    };

    const container = getContainer();
    await container.items.create(incident);
    return jsonResponse(incident, 201);
  },
});

// ─── Update Incident ─────────────────────────────────────────────────────────
app.http('updateIncident', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'incidents/{id}',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const id = req.params.id!;
    const body = await req.json();
    const parsed = UpdateIncidentSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.message);

    const container = getContainer();
    const { resource: existing } = await container.item(id, TENANT_ID).read<Incident>();
    if (!existing) return errorResponse('Not found', 404);

    const updated: Incident = {
      ...existing,
      ...parsed.data,
      updatedAt: nowISO(),
      auditLog: [...existing.auditLog, createAuditEntry(USER, 'updated', JSON.stringify(parsed.data))],
    };
    await container.item(id, TENANT_ID).replace(updated);
    return jsonResponse(updated);
  },
});

// ─── Delete Incident ─────────────────────────────────────────────────────────
app.http('deleteIncident', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'incidents/{id}',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const id = req.params.id!;
    const container = getContainer();
    try {
      await container.item(id, TENANT_ID).delete();
      return { status: 204 };
    } catch {
      return errorResponse('Not found', 404);
    }
  },
});

// ─── Add Timeline Event ──────────────────────────────────────────────────────
app.http('addTimelineEvent', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'incidents/{id}/timeline',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const id = req.params.id!;
    const body = await req.json();
    const parsed = CreateTimelineEventSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.message);

    const container = getContainer();
    const { resource: existing } = await container.item(id, TENANT_ID).read<Incident>();
    if (!existing) return errorResponse('Not found', 404);

    const event: TimelineEvent = { id: uuid(), ...parsed.data };
    const updated: Incident = {
      ...existing,
      timeline: [...existing.timeline, event].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),
      updatedAt: nowISO(),
      auditLog: [...existing.auditLog, createAuditEntry(USER, 'timeline_added', event.description)],
    };
    await container.item(id, TENANT_ID).replace(updated);
    return jsonResponse(event, 201);
  },
});

// ─── Delete Timeline Event ───────────────────────────────────────────────────
app.http('deleteTimelineEvent', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'incidents/{id}/timeline/{eventId}',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { id, eventId } = req.params;
    const container = getContainer();
    const { resource: existing } = await container.item(id!, TENANT_ID).read<Incident>();
    if (!existing) return errorResponse('Not found', 404);

    const updated: Incident = {
      ...existing,
      timeline: existing.timeline.filter((e) => e.id !== eventId),
      updatedAt: nowISO(),
      auditLog: [...existing.auditLog, createAuditEntry(USER, 'timeline_deleted', eventId)],
    };
    await container.item(id!, TENANT_ID).replace(updated);
    return { status: 204 };
  },
});

// ─── Add Action Item ─────────────────────────────────────────────────────────
app.http('addActionItem', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'incidents/{id}/actions',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const id = req.params.id!;
    const body = await req.json();
    const parsed = CreateActionItemSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.message);

    const container = getContainer();
    const { resource: existing } = await container.item(id, TENANT_ID).read<Incident>();
    if (!existing) return errorResponse('Not found', 404);

    const item: ActionItem = { id: uuid(), ...parsed.data };
    const updated: Incident = {
      ...existing,
      actionItems: [...existing.actionItems, item],
      updatedAt: nowISO(),
      auditLog: [...existing.auditLog, createAuditEntry(USER, 'action_added', item.title)],
    };
    await container.item(id, TENANT_ID).replace(updated);
    return jsonResponse(item, 201);
  },
});

// ─── Update Action Item ──────────────────────────────────────────────────────
app.http('updateActionItem', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'incidents/{id}/actions/{actionId}',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { id, actionId } = req.params;
    const body = (await req.json()) as Partial<ActionItem>;

    const container = getContainer();
    const { resource: existing } = await container.item(id!, TENANT_ID).read<Incident>();
    if (!existing) return errorResponse('Not found', 404);

    const idx = existing.actionItems.findIndex((a) => a.id === actionId);
    if (idx === -1) return errorResponse('Action item not found', 404);

    const updatedItem: ActionItem = { ...existing.actionItems[idx], ...body };
    const actionItems = [...existing.actionItems];
    actionItems[idx] = updatedItem;

    const updated: Incident = {
      ...existing,
      actionItems,
      updatedAt: nowISO(),
      auditLog: [...existing.auditLog, createAuditEntry(USER, 'action_updated', actionId)],
    };
    await container.item(id!, TENANT_ID).replace(updated);
    return jsonResponse(updatedItem);
  },
});

// ─── Delete Action Item ──────────────────────────────────────────────────────
app.http('deleteActionItem', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'incidents/{id}/actions/{actionId}',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const { id, actionId } = req.params;
    const container = getContainer();
    const { resource: existing } = await container.item(id!, TENANT_ID).read<Incident>();
    if (!existing) return errorResponse('Not found', 404);

    const updated: Incident = {
      ...existing,
      actionItems: existing.actionItems.filter((a) => a.id !== actionId),
      updatedAt: nowISO(),
      auditLog: [...existing.auditLog, createAuditEntry(USER, 'action_deleted', actionId)],
    };
    await container.item(id!, TENANT_ID).replace(updated);
    return { status: 204 };
  },
});

// ─── Export to Markdown ──────────────────────────────────────────────────────
app.http('exportMarkdown', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'incidents/{id}/export',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const id = req.params.id!;
    const container = getContainer();
    const { resource } = await container.item(id, TENANT_ID).read<Incident>();
    if (!resource) return errorResponse('Not found', 404);

    const md = generateMarkdown(resource);
    return {
      status: 200,
      body: md,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="postmortem-${id}.md"`,
      },
    };
  },
});

function generateMarkdown(inc: Incident): string {
  const lines: string[] = [];
  lines.push(`# Postmortem: ${inc.title}`);
  lines.push('');
  lines.push(`**Severity:** ${inc.severity}  `);
  lines.push(`**Status:** ${inc.status}  `);
  lines.push(`**Started:** ${inc.startedAt}  `);
  if (inc.resolvedAt) lines.push(`**Resolved:** ${inc.resolvedAt}  `);
  lines.push('');
  if (inc.servicesImpacted.length) {
    lines.push('## Services Impacted');
    inc.servicesImpacted.forEach((s) => lines.push(`- ${s}`));
    lines.push('');
  }
  if (inc.summary) {
    lines.push('## Summary');
    lines.push(inc.summary);
    lines.push('');
  }
  if (inc.timeline.length) {
    lines.push('## Timeline');
    inc.timeline.forEach((e) => {
      lines.push(`- **${e.timestamp}** (${e.author}): ${e.description}`);
    });
    lines.push('');
  }
  if (inc.actionItems.length) {
    lines.push('## Action Items');
    inc.actionItems.forEach((a) => {
      const due = a.dueDate ? ` (due ${a.dueDate})` : '';
      lines.push(`- [${a.status === 'done' ? 'x' : ' '}] ${a.title} — *${a.owner}*${due}`);
    });
    lines.push('');
  }
  lines.push('---');
  lines.push(`*Generated at ${nowISO()}*`);
  return lines.join('\n');
}

