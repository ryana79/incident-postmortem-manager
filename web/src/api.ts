import type { Incident, CreateIncident, TimelineEvent, CreateTimelineEvent, ActionItem, CreateActionItem } from './types';
import { demoStore } from './demoStore';

// Use Azure Function URL in production (or configured env var), local proxy in development
const BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD 
  ? 'https://postmortem-dev-uixauh3woqkza-api.azurewebsites.net/api'
  : '/api');

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
export const listIncidents = async (): Promise<Incident[]> => {
  try {
    return await request<Incident[]>('/incidents');
  } catch (err) {
    console.info('Live API unavailable; serving from demo store');
    return demoStore.listIncidents();
  }
};

export const getIncident = async (id: string): Promise<Incident> => {
  try {
    return await request<Incident>(`/incidents/${id}`);
  } catch (err) {
    return demoStore.getIncident(id);
  }
};

export const createIncident = async (data: CreateIncident): Promise<Incident> => {
  try {
    return await request<Incident>('/incidents', { method: 'POST', body: JSON.stringify(data) });
  } catch (err) {
    return demoStore.createIncident(data);
  }
};

export const updateIncident = async (id: string, data: Partial<CreateIncident>): Promise<Incident> => {
  try {
    return await request<Incident>(`/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  } catch (err) {
    return demoStore.updateIncident(id, data);
  }
};

export const deleteIncident = async (id: string): Promise<void> => {
  try {
    await request<void>(`/incidents/${id}`, { method: 'DELETE' });
  } catch (err) {
    demoStore.deleteIncident(id);
  }
};

// ─── Timeline ────────────────────────────────────────────────────────────────
export const addTimelineEvent = async (incidentId: string, data: CreateTimelineEvent): Promise<TimelineEvent> => {
  try {
    return await request<TimelineEvent>(`/incidents/${incidentId}/timeline`, { method: 'POST', body: JSON.stringify(data) });
  } catch (err) {
    return demoStore.addTimelineEvent(incidentId, data);
  }
};

export const deleteTimelineEvent = async (incidentId: string, eventId: string): Promise<void> => {
  try {
    await request<void>(`/incidents/${incidentId}/timeline/${eventId}`, { method: 'DELETE' });
  } catch (err) {
    demoStore.deleteTimelineEvent(incidentId, eventId);
  }
};

// ─── Action Items ────────────────────────────────────────────────────────────
export const addActionItem = async (incidentId: string, data: CreateActionItem): Promise<ActionItem> => {
  try {
    return await request<ActionItem>(`/incidents/${incidentId}/actions`, { method: 'POST', body: JSON.stringify(data) });
  } catch (err) {
    return demoStore.addActionItem(incidentId, data);
  }
};

export const updateActionItem = async (
  incidentId: string,
  actionId: string,
  data: Partial<CreateActionItem>
): Promise<ActionItem> => {
  try {
    return await request<ActionItem>(`/incidents/${incidentId}/actions/${actionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  } catch (err) {
    return demoStore.updateActionItem(incidentId, actionId, data);
  }
};

export const deleteActionItem = async (incidentId: string, actionId: string): Promise<void> => {
  try {
    await request<void>(`/incidents/${incidentId}/actions/${actionId}`, { method: 'DELETE' });
  } catch (err) {
    demoStore.deleteActionItem(incidentId, actionId);
  }
};

// ─── Export ──────────────────────────────────────────────────────────────────
export const exportMarkdown = async (incidentId: string): Promise<string> => {
  try {
    const principal = await getClientPrincipal();
    const headers: Record<string, string> = {};
    if (principal) {
      headers['x-ms-client-principal'] = principal;
    }
    const res = await fetch(`${BASE}/incidents/${incidentId}/export`, { headers });
    if (!res.ok) throw new Error('Export failed');
    return await res.text();
  } catch (err) {
    return demoStore.exportMarkdown(incidentId);
  }
};

// ─── AI Features ─────────────────────────────────────────────────────────────
// Include timezone offset so API can format times correctly for the user
const getTimezonePayload = () => ({
  timezoneOffset: new Date().getTimezoneOffset(),
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});

export const generateSummary = async (incidentId: string): Promise<{ summary: string }> => {
  try {
    return await request<{ summary: string }>(`/incidents/${incidentId}/ai/summary`, {
      method: 'POST',
      body: JSON.stringify(getTimezonePayload()),
    });
  } catch (err) {
    return demoStore.generateSummary(incidentId);
  }
};

export const suggestActions = async (incidentId: string): Promise<{ suggestions: string[] }> => {
  try {
    return await request<{ suggestions: string[] }>(`/incidents/${incidentId}/ai/actions`, {
      method: 'POST',
      body: JSON.stringify(getTimezonePayload()),
    });
  } catch (err) {
    return demoStore.suggestActions(incidentId);
  }
};

export const generateReport = async (incidentId: string): Promise<{ report: string }> => {
  try {
    return await request<{ report: string }>(`/incidents/${incidentId}/ai/report`, {
      method: 'POST',
      body: JSON.stringify(getTimezonePayload()),
    });
  } catch (err) {
    return demoStore.generateReport(incidentId);
  }
};
