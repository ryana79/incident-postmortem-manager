import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────
export const SeveritySchema = z.enum(['SEV1', 'SEV2', 'SEV3', 'SEV4']);
export type Severity = z.infer<typeof SeveritySchema>;

export const IncidentStatusSchema = z.enum(['investigating', 'identified', 'monitoring', 'resolved']);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

export const ActionItemStatusSchema = z.enum(['open', 'in_progress', 'done']);
export type ActionItemStatus = z.infer<typeof ActionItemStatusSchema>;

// ─── Timeline Event ──────────────────────────────────────────────────────────
export const TimelineEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  description: z.string().min(1).max(2000),
  author: z.string().min(1).max(200),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

// ─── Action Item ─────────────────────────────────────────────────────────────
export const ActionItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(500),
  owner: z.string().min(1).max(200),
  dueDate: z.string().datetime().optional(),
  status: ActionItemStatusSchema,
});
export type ActionItem = z.infer<typeof ActionItemSchema>;

// ─── Audit Log Entry ─────────────────────────────────────────────────────────
export const AuditEntrySchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  user: z.string(),
  action: z.string(),
  details: z.string().optional(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

// ─── Incident ────────────────────────────────────────────────────────────────
export const IncidentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().default('default'),
  title: z.string().min(1).max(500),
  severity: SeveritySchema,
  status: IncidentStatusSchema,
  summary: z.string().max(5000).optional(),
  servicesImpacted: z.array(z.string()).default([]),
  startedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
  timeline: z.array(TimelineEventSchema).default([]),
  actionItems: z.array(ActionItemSchema).default([]),
  auditLog: z.array(AuditEntrySchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Incident = z.infer<typeof IncidentSchema>;

// ─── Create/Update DTOs ──────────────────────────────────────────────────────
export const CreateIncidentSchema = IncidentSchema.omit({
  id: true,
  tenantId: true,
  timeline: true,
  actionItems: true,
  auditLog: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateIncident = z.infer<typeof CreateIncidentSchema>;

export const UpdateIncidentSchema = CreateIncidentSchema.partial();
export type UpdateIncident = z.infer<typeof UpdateIncidentSchema>;

export const CreateTimelineEventSchema = TimelineEventSchema.omit({ id: true });
export type CreateTimelineEvent = z.infer<typeof CreateTimelineEventSchema>;

export const CreateActionItemSchema = ActionItemSchema.omit({ id: true });
export type CreateActionItem = z.infer<typeof CreateActionItemSchema>;

