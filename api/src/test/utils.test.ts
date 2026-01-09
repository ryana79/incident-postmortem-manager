// ─────────────────────────────────────────────────────────────────────────────
// Unit Tests: Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

import { uuid, nowISO, createAuditEntry, jsonResponse, errorResponse } from '../utils';

describe('Utils', () => {
  describe('uuid', () => {
    it('should generate a valid UUID v4', () => {
      const id = uuid();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique UUIDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => uuid()));
      expect(ids.size).toBe(100);
    });
  });

  describe('nowISO', () => {
    it('should return a valid ISO date string', () => {
      const timestamp = nowISO();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('should return current time', () => {
      const before = Date.now();
      const timestamp = nowISO();
      const after = Date.now();
      const parsed = new Date(timestamp).getTime();
      
      expect(parsed).toBeGreaterThanOrEqual(before);
      expect(parsed).toBeLessThanOrEqual(after);
    });
  });

  describe('createAuditEntry', () => {
    it('should create an audit entry with required fields', () => {
      const entry = createAuditEntry('testuser', 'created');
      
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('timestamp');
      expect(entry.user).toBe('testuser');
      expect(entry.action).toBe('created');
      expect(entry.details).toBeUndefined();
    });

    it('should include details when provided', () => {
      const entry = createAuditEntry('admin', 'updated', 'Changed title');
      
      expect(entry.details).toBe('Changed title');
    });

    it('should generate unique IDs for each entry', () => {
      const entry1 = createAuditEntry('user1', 'created');
      const entry2 = createAuditEntry('user2', 'created');
      
      expect(entry1.id).not.toBe(entry2.id);
    });
  });

  describe('jsonResponse', () => {
    it('should return a response with JSON body', () => {
      const data = { foo: 'bar' };
      const response = jsonResponse(data);
      
      expect(response.status).toBe(200);
      expect(response.headers?.['Content-Type']).toBe('application/json');
      expect(response.jsonBody).toEqual(data);
    });

    it('should use provided status code', () => {
      const response = jsonResponse({ created: true }, 201);
      expect(response.status).toBe(201);
    });

    it('should handle arrays', () => {
      const data = [1, 2, 3];
      const response = jsonResponse(data);
      expect(response.jsonBody).toEqual([1, 2, 3]);
    });

    it('should handle null', () => {
      const response = jsonResponse(null);
      expect(response.jsonBody).toBeNull();
    });
  });

  describe('errorResponse', () => {
    it('should return error response with message', () => {
      const response = errorResponse('Something went wrong');
      
      expect(response.status).toBe(400);
      expect(response.headers?.['Content-Type']).toBe('application/json');
      expect(response.jsonBody).toEqual({
        error: 'Something went wrong',
      });
    });

    it('should use provided status code', () => {
      const response = errorResponse('Not found', 404);
      expect(response.status).toBe(404);
    });

    it('should default to 400 status', () => {
      const response = errorResponse('Bad request');
      expect(response.status).toBe(400);
    });
  });
});

