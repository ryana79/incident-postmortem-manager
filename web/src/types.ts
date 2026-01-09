export type Severity = 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4';
export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved';
export type ActionItemStatus = 'open' | 'in_progress' | 'done';

export interface TimelineEvent {
  id: string;
  timestamp: string;
  description: string;
  author: string;
}

export interface ActionItem {
  id: string;
  title: string;
  owner: string;
  dueDate?: string;
  status: ActionItemStatus;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details?: string;
}

export interface Incident {
  id: string;
  tenantId: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  summary?: string;
  servicesImpacted: string[];
  startedAt: string;
  resolvedAt?: string;
  timeline: TimelineEvent[];
  actionItems: ActionItem[];
  auditLog: AuditEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateIncident {
  title: string;
  severity: Severity;
  status: IncidentStatus;
  summary?: string;
  servicesImpacted?: string[];
  startedAt: string;
  resolvedAt?: string;
}

export interface CreateTimelineEvent {
  timestamp: string;
  description: string;
  author: string;
}

export interface CreateActionItem {
  title: string;
  owner: string;
  dueDate?: string;
  status: ActionItemStatus;
}

