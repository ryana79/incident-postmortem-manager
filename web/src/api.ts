import type { Incident, CreateIncident, TimelineEvent, CreateTimelineEvent, ActionItem, CreateActionItem } from './types';

// Use Azure Function URL in production, local proxy in development
const BASE = import.meta.env.PROD 
  ? 'https://postmortem-dev-uixauh3woqkza-api.azurewebsites.net/api'
  : '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Incidents ───────────────────────────────────────────────────────────────
export const listIncidents = () => request<Incident[]>('/incidents');

export const getIncident = (id: string) => request<Incident>(`/incidents/${id}`);

export const createIncident = (data: CreateIncident) =>
  request<Incident>('/incidents', { method: 'POST', body: JSON.stringify(data) });

export const updateIncident = (id: string, data: Partial<CreateIncident>) =>
  request<Incident>(`/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteIncident = (id: string) =>
  request<void>(`/incidents/${id}`, { method: 'DELETE' });

// ─── Timeline ────────────────────────────────────────────────────────────────
export const addTimelineEvent = (incidentId: string, data: CreateTimelineEvent) =>
  request<TimelineEvent>(`/incidents/${incidentId}/timeline`, { method: 'POST', body: JSON.stringify(data) });

export const deleteTimelineEvent = (incidentId: string, eventId: string) =>
  request<void>(`/incidents/${incidentId}/timeline/${eventId}`, { method: 'DELETE' });

// ─── Action Items ────────────────────────────────────────────────────────────
export const addActionItem = (incidentId: string, data: CreateActionItem) =>
  request<ActionItem>(`/incidents/${incidentId}/actions`, { method: 'POST', body: JSON.stringify(data) });

export const updateActionItem = (incidentId: string, actionId: string, data: Partial<CreateActionItem>) =>
  request<ActionItem>(`/incidents/${incidentId}/actions/${actionId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteActionItem = (incidentId: string, actionId: string) =>
  request<void>(`/incidents/${incidentId}/actions/${actionId}`, { method: 'DELETE' });

// ─── Export ──────────────────────────────────────────────────────────────────
export const exportMarkdown = async (incidentId: string): Promise<string> => {
  const res = await fetch(`${BASE}/incidents/${incidentId}/export`);
  if (!res.ok) throw new Error('Export failed');
  return res.text();
};

