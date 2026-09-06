import type {
  Incident,
  CreateIncident,
  TimelineEvent,
  CreateTimelineEvent,
  ActionItem,
  CreateActionItem,
} from './types';

const STORAGE_KEY = 'postmortem_incidents_v1';

const INITIAL_INCIDENTS: Incident[] = [
  {
    id: 'inc-8492',
    tenantId: 'default',
    title: 'Cosmos DB Regional Failover & Elevated Read Latency',
    severity: 'SEV1',
    status: 'resolved',
    summary:
      'Automated failover of primary Cosmos DB replica in eastus triggered elevated p99 latency across gateway services. Secondary read region in eastus2 handled traffic while connection pool re-established.',
    servicesImpacted: ['cosmos-db', 'gateway-api', 'auth-service'],
    startedAt: '2026-08-14T18:22:00.000Z',
    resolvedAt: '2026-08-14T19:15:00.000Z',
    timeline: [
      {
        id: 't-1',
        timestamp: '2026-08-14T18:22:00.000Z',
        description: 'Alert fired: Cosmos DB p99 latency > 800ms across 3 consecutive evaluation periods.',
        author: 'monitor-alert',
      },
      {
        id: 't-2',
        timestamp: '2026-08-14T18:27:00.000Z',
        description: 'Incident bridge opened. On-call platform engineer joined.',
        author: 'ryan.amir',
      },
      {
        id: 't-3',
        timestamp: '2026-08-14T18:35:00.000Z',
        description: 'Identified primary partition re-routing in progress in Azure portal.',
        author: 'ryan.amir',
      },
      {
        id: 't-4',
        timestamp: '2026-08-14T18:42:00.000Z',
        description: 'Forced regional read reroute to eastus2 secondary replica.',
        author: 'ryan.amir',
      },
      {
        id: 't-5',
        timestamp: '2026-08-14T18:55:00.000Z',
        description: 'Latency returned to baseline (14ms). Monitoring period initiated.',
        author: 'platform-oncall',
      },
      {
        id: 't-6',
        timestamp: '2026-08-14T19:15:00.000Z',
        description: 'Incident marked resolved. Postmortem action items logged.',
        author: 'ryan.amir',
      },
    ],
    actionItems: [
      {
        id: 'a-1',
        title: 'Update Cosmos DB SDK retry policy to use exponential backoff with jitter',
        owner: 'platform-eng',
        dueDate: '2026-08-25',
        status: 'done',
      },
      {
        id: 'a-2',
        title: 'Add synthetic health-check canary probing both primary and secondary read endpoints',
        owner: 'sre-team',
        dueDate: '2026-09-01',
        status: 'open',
      },
      {
        id: 'a-3',
        title: 'Publish cross-region failover runbook to engineering knowledge base',
        owner: 'ryan.amir',
        dueDate: '2026-08-20',
        status: 'done',
      },
    ],
    auditLog: [
      {
        id: 'aud-1',
        timestamp: '2026-08-14T18:28:00.000Z',
        user: 'ryan.amir',
        action: 'CREATED',
        details: 'Initial postmortem record opened',
      },
      {
        id: 'aud-2',
        timestamp: '2026-08-14T19:15:00.000Z',
        user: 'ryan.amir',
        action: 'RESOLVED',
        details: 'Status changed to resolved',
      },
    ],
    createdAt: '2026-08-14T18:28:00.000Z',
    updatedAt: '2026-08-14T19:15:00.000Z',
  },
  {
    id: 'inc-8510',
    tenantId: 'default',
    title: 'Redis Rate-Limiter Connection Saturation on Public Ingress',
    severity: 'SEV2',
    status: 'monitoring',
    summary:
      'Burst traffic during mobile app update saturated the rate limiter connection pool, resulting in transient 429 and 500 responses on unauthenticated public endpoints.',
    servicesImpacted: ['redis-cache', 'api-ingress', 'mobile-gateway'],
    startedAt: '2026-08-28T14:05:00.000Z',
    timeline: [
      {
        id: 't-10',
        timestamp: '2026-08-28T14:05:00.000Z',
        description: 'HTTP 5xx error rate spiked to 4.2% on public ingress gateway.',
        author: 'monitor-alert',
      },
      {
        id: 't-11',
        timestamp: '2026-08-28T14:12:00.000Z',
        description: 'Scaled ingress pods from 4 to 12 replicas to absorb connection surge.',
        author: 'sre-team',
      },
      {
        id: 't-12',
        timestamp: '2026-08-28T14:18:00.000Z',
        description: 'Increased Redis client max pool size to 500 across gateway instances.',
        author: 'ryan.amir',
      },
      {
        id: 't-13',
        timestamp: '2026-08-28T14:25:00.000Z',
        description: 'Error rate dropped below 0.05%. Entering monitoring phase.',
        author: 'platform-oncall',
      },
    ],
    actionItems: [
      {
        id: 'a-10',
        title: 'Implement adaptive rate-limiting based on client fingerprinting',
        owner: 'api-team',
        dueDate: '2026-09-15',
        status: 'open',
      },
      {
        id: 'a-11',
        title: 'Configure autoscaling metric on Redis connection saturation percentage',
        owner: 'platform-eng',
        dueDate: '2026-09-10',
        status: 'open',
      },
    ],
    auditLog: [
      {
        id: 'aud-10',
        timestamp: '2026-08-28T14:08:00.000Z',
        user: 'sre-team',
        action: 'CREATED',
      },
    ],
    createdAt: '2026-08-28T14:08:00.000Z',
    updatedAt: '2026-08-28T14:25:00.000Z',
  },
  {
    id: 'inc-8533',
    tenantId: 'default',
    title: 'Certificate Expiry on Internal Metrics Ingestion Endpoint',
    severity: 'SEV3',
    status: 'resolved',
    summary:
      'Internal telemetry collector TLS cert expired, causing temporary gap in Prometheus custom metrics ingestion.',
    servicesImpacted: ['monitoring', 'prometheus-collector'],
    startedAt: '2026-09-02T09:15:00.000Z',
    resolvedAt: '2026-09-02T09:40:00.000Z',
    timeline: [
      {
        id: 't-20',
        timestamp: '2026-09-02T09:15:00.000Z',
        description: 'Prometheus metrics scrapers logged certificate expired errors.',
        author: 'ryan.amir',
      },
      {
        id: 't-21',
        timestamp: '2026-09-02T09:28:00.000Z',
        description: 'Renewed certificate via cert-manager and restarted collector daemonset.',
        author: 'ryan.amir',
      },
      {
        id: 't-22',
        timestamp: '2026-09-02T09:40:00.000Z',
        description: 'Metrics ingestion verified healthy across all nodes.',
        author: 'ryan.amir',
      },
    ],
    actionItems: [
      {
        id: 'a-20',
        title: 'Add cert-manager expiry alerts 30 days prior to expiration',
        owner: 'ryan.amir',
        dueDate: '2026-09-05',
        status: 'done',
      },
    ],
    auditLog: [
      {
        id: 'aud-20',
        timestamp: '2026-09-02T09:18:00.000Z',
        user: 'ryan.amir',
        action: 'CREATED',
      },
      {
        id: 'aud-21',
        timestamp: '2026-09-02T09:40:00.000Z',
        user: 'ryan.amir',
        action: 'RESOLVED',
      },
    ],
    createdAt: '2026-09-02T09:18:00.000Z',
    updatedAt: '2026-09-02T09:40:00.000Z',
  },
];

function getStoredIncidents(): Incident[] {
  if (typeof window === 'undefined') return INITIAL_INCIDENTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_INCIDENTS));
      return INITIAL_INCIDENTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_INCIDENTS;
  } catch {
    return INITIAL_INCIDENTS;
  }
}

function saveIncidents(incidents: Incident[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(incidents));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

export const demoStore = {
  listIncidents(): Incident[] {
    return getStoredIncidents();
  },

  getIncident(id: string): Incident {
    const items = getStoredIncidents();
    const match = items.find((inc) => inc.id === id);
    if (!match) throw new Error('Incident not found');
    return match;
  },

  createIncident(data: CreateIncident): Incident {
    const items = getStoredIncidents();
    const now = new Date().toISOString();
    const newInc: Incident = {
      id: `inc-${Math.floor(1000 + Math.random() * 9000)}`,
      tenantId: 'default',
      title: data.title,
      severity: data.severity,
      status: data.status,
      summary: data.summary,
      servicesImpacted: data.servicesImpacted || [],
      startedAt: data.startedAt,
      resolvedAt: data.resolvedAt,
      timeline: [],
      actionItems: [],
      auditLog: [
        {
          id: `aud-${Date.now()}`,
          timestamp: now,
          user: 'current.user',
          action: 'CREATED',
          details: 'Incident created via console',
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    saveIncidents([newInc, ...items]);
    return newInc;
  },

  updateIncident(id: string, updates: Partial<CreateIncident>): Incident {
    const items = getStoredIncidents();
    const index = items.findIndex((inc) => inc.id === id);
    if (index === -1) throw new Error('Incident not found');

    const updated: Incident = {
      ...items[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    items[index] = updated;
    saveIncidents(items);
    return updated;
  },

  deleteIncident(id: string): void {
    const items = getStoredIncidents().filter((inc) => inc.id !== id);
    saveIncidents(items);
  },

  addTimelineEvent(incidentId: string, data: CreateTimelineEvent): TimelineEvent {
    const items = getStoredIncidents();
    const index = items.findIndex((inc) => inc.id === incidentId);
    if (index === -1) throw new Error('Incident not found');

    const event: TimelineEvent = {
      id: `t-${Date.now()}`,
      timestamp: data.timestamp,
      description: data.description,
      author: data.author || 'engineer',
    };
    items[index].timeline.push(event);
    items[index].updatedAt = new Date().toISOString();
    saveIncidents(items);
    return event;
  },

  deleteTimelineEvent(incidentId: string, eventId: string): void {
    const items = getStoredIncidents();
    const index = items.findIndex((inc) => inc.id === incidentId);
    if (index === -1) throw new Error('Incident not found');

    items[index].timeline = items[index].timeline.filter((t) => t.id !== eventId);
    items[index].updatedAt = new Date().toISOString();
    saveIncidents(items);
  },

  addActionItem(incidentId: string, data: CreateActionItem): ActionItem {
    const items = getStoredIncidents();
    const index = items.findIndex((inc) => inc.id === incidentId);
    if (index === -1) throw new Error('Incident not found');

    const item: ActionItem = {
      id: `a-${Date.now()}`,
      title: data.title,
      owner: data.owner,
      dueDate: data.dueDate,
      status: data.status,
    };
    items[index].actionItems.push(item);
    items[index].updatedAt = new Date().toISOString();
    saveIncidents(items);
    return item;
  },

  updateActionItem(
    incidentId: string,
    actionId: string,
    updates: Partial<CreateActionItem>
  ): ActionItem {
    const items = getStoredIncidents();
    const incIndex = items.findIndex((inc) => inc.id === incidentId);
    if (incIndex === -1) throw new Error('Incident not found');

    const actionIndex = items[incIndex].actionItems.findIndex((a) => a.id === actionId);
    if (actionIndex === -1) throw new Error('Action item not found');

    const updated = { ...items[incIndex].actionItems[actionIndex], ...updates };
    items[incIndex].actionItems[actionIndex] = updated;
    items[incIndex].updatedAt = new Date().toISOString();
    saveIncidents(items);
    return updated;
  },

  deleteActionItem(incidentId: string, actionId: string): void {
    const items = getStoredIncidents();
    const index = items.findIndex((inc) => inc.id === incidentId);
    if (index === -1) throw new Error('Incident not found');

    items[index].actionItems = items[index].actionItems.filter((a) => a.id !== actionId);
    items[index].updatedAt = new Date().toISOString();
    saveIncidents(items);
  },

  exportMarkdown(incidentId: string): string {
    const inc = this.getIncident(incidentId);
    return `# Postmortem: ${inc.title}
**Severity**: ${inc.severity}  
**Status**: ${inc.status}  
**Started**: ${inc.startedAt}  
**Resolved**: ${inc.resolvedAt || 'Ongoing'}  
**Services Impacted**: ${inc.servicesImpacted.join(', ') || 'None'}

## Executive Summary
${inc.summary || 'No summary provided.'}

## Timeline
${inc.timeline
  .map((t) => `- **${new Date(t.timestamp).toLocaleTimeString()}** (${t.author}): ${t.description}`)
  .join('\n') || 'No timeline events recorded.'}

## Action Items
${inc.actionItems
  .map(
    (a) => `- [${a.status === 'done' ? 'x' : ' '}] **${a.title}** (Owner: ${a.owner}${a.dueDate ? `, Due: ${a.dueDate}` : ''})`
  )
  .join('\n') || 'No action items logged.'}
`;
  },

  generateSummary(incidentId: string): { summary: string } {
    const inc = this.getIncident(incidentId);
    const services = inc.servicesImpacted.join(', ') || 'core infrastructure';
    return {
      summary: `On ${new Date(inc.startedAt).toLocaleDateString()}, a ${inc.severity} incident impacted ${services}. Rapid isolation and failover restored normal operation with verified zero data loss. Preventative work items have been queued to guard against recurring failure modes.`,
    };
  },

  suggestActions(incidentId: string): { suggestions: string[] } {
    const inc = this.getIncident(incidentId);
    return {
      suggestions: [
        `Add synthetic health canary with automated threshold alerting for ${inc.servicesImpacted[0] || 'service'}`,
        `Update architecture failover runbook and conduct simulated game-day drill`,
        `Audit client SDK retry policies to prevent connection storming during transient recovery`,
      ],
    };
  },

  generateReport(incidentId: string): { report: string } {
    return {
      report: this.exportMarkdown(incidentId),
    };
  },
};
