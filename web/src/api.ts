import type { Incident, CreateIncident, TimelineEvent, CreateTimelineEvent, ActionItem, CreateActionItem } from './types';

// Use Azure Function URL in production, local proxy in development
const BASE = import.meta.env.PROD 
  ? 'https://postmortem-dev-uixauh3woqkza-api.azurewebsites.net/api'
  : '/api';

// Cache the user's client principal for auth headers
let cachedPrincipal: string | null = null;

// Fetch and cache the SWA client principal
async function getClientPrincipal(): Promise<string | null> {
  if (cachedPrincipal !== null) return cachedPrincipal;
  
  try {
    const res = await fetch('/.auth/me');
    if (res.ok) {
      const data = await res.json();
      if (data.clientPrincipal) {
        // Encode the principal as base64 (same format SWA uses)
        cachedPrincipal = btoa(JSON.stringify(data.clientPrincipal));
        return cachedPrincipal;
      }
    }
  } catch {
    // Auth not available (local dev or error)
  }
  
  cachedPrincipal = '';
  return null;
}

// Clear cached principal (call on logout)
export function clearAuthCache() {
  cachedPrincipal = null;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  // Get the client principal for auth
  const principal = await getClientPrincipal();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Pass the auth principal to the API (same header SWA uses)
  if (principal) {
    headers['x-ms-client-principal'] = principal;
  }
  
  const res = await fetch(`${BASE}${path}`, {
    headers,
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
  const principal = await getClientPrincipal();
  const headers: Record<string, string> = {};
  if (principal) {
    headers['x-ms-client-principal'] = principal;
  }
  
  const res = await fetch(`${BASE}/incidents/${incidentId}/export`, { headers });
  if (!res.ok) throw new Error('Export failed');
  return res.text();
};

// ─── AI Features ─────────────────────────────────────────────────────────────
// Include timezone offset so API can format times correctly for the user
const getTimezonePayload = () => ({
  timezoneOffset: new Date().getTimezoneOffset(),
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
});

export const generateSummary = (incidentId: string) =>
  request<{ summary: string }>(`/incidents/${incidentId}/ai/summary`, { 
    method: 'POST',
    body: JSON.stringify(getTimezonePayload())
  });

export const suggestActions = (incidentId: string) =>
  request<{ suggestions: string[] }>(`/incidents/${incidentId}/ai/actions`, { 
    method: 'POST',
    body: JSON.stringify(getTimezonePayload())
  });

export const generateReport = (incidentId: string) =>
  request<{ report: string }>(`/incidents/${incidentId}/ai/report`, { 
    method: 'POST',
    body: JSON.stringify(getTimezonePayload())
  });
