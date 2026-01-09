import { randomUUID } from 'crypto';
import { AuditEntry } from './types';

export function uuid(): string {
  return randomUUID();
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function createAuditEntry(user: string, action: string, details?: string): AuditEntry {
  return {
    id: uuid(),
    timestamp: nowISO(),
    user,
    action,
    details,
  };
}

export function jsonResponse(body: unknown, status = 200) {
  return {
    status,
    jsonBody: body,
    headers: { 'Content-Type': 'application/json' },
  };
}

export function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

