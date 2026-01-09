// ─────────────────────────────────────────────────────────────────────────────
// Unit Tests: Zod Schema Validation
// ─────────────────────────────────────────────────────────────────────────────

import {
  CreateIncidentSchema,
  UpdateIncidentSchema,
  CreateTimelineEventSchema,
  CreateActionItemSchema,
} from '../types';

describe('Schema Validation', () => {
  describe('CreateIncidentSchema', () => {
    it('should validate a valid incident', () => {
      const validIncident = {
        title: 'API Gateway Outage',
        severity: 'SEV2',
        status: 'investigating',
        startedAt: '2026-01-09T12:00:00Z',
        servicesImpacted: ['api-gateway', 'auth-service'],
      };

      const result = CreateIncidentSchema.safeParse(validIncident);
      expect(result.success).toBe(true);
    });

    it('should require title', () => {
      const invalidIncident = {
        severity: 'SEV2',
        status: 'investigating',
        startedAt: '2026-01-09T12:00:00Z',
        servicesImpacted: [],
      };

      const result = CreateIncidentSchema.safeParse(invalidIncident);
      expect(result.success).toBe(false);
    });

    it('should validate severity enum', () => {
      const invalidSeverity = {
        title: 'Test Incident',
        severity: 'SEV5',  // Invalid
        status: 'investigating',
        startedAt: '2026-01-09T12:00:00Z',
        servicesImpacted: [],
      };

      const result = CreateIncidentSchema.safeParse(invalidSeverity);
      expect(result.success).toBe(false);
    });

    it('should validate status enum', () => {
      const invalidStatus = {
        title: 'Test Incident',
        severity: 'SEV2',
        status: 'unknown',  // Invalid
        startedAt: '2026-01-09T12:00:00Z',
        servicesImpacted: [],
      };

      const result = CreateIncidentSchema.safeParse(invalidStatus);
      expect(result.success).toBe(false);
    });

    it('should accept all valid severities', () => {
      const severities = ['SEV1', 'SEV2', 'SEV3', 'SEV4'];
      
      for (const severity of severities) {
        const incident = {
          title: 'Test',
          severity,
          status: 'investigating',
          startedAt: '2026-01-09T12:00:00Z',
          servicesImpacted: [],
        };
        const result = CreateIncidentSchema.safeParse(incident);
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid statuses', () => {
      const statuses = ['investigating', 'identified', 'monitoring', 'resolved'];
      
      for (const status of statuses) {
        const incident = {
          title: 'Test',
          severity: 'SEV2',
          status,
          startedAt: '2026-01-09T12:00:00Z',
          servicesImpacted: [],
        };
        const result = CreateIncidentSchema.safeParse(incident);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('UpdateIncidentSchema', () => {
    it('should allow partial updates', () => {
      const update = { title: 'Updated Title' };
      const result = UpdateIncidentSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should allow empty object', () => {
      const result = UpdateIncidentSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate severity when provided', () => {
      const update = { severity: 'INVALID' };
      const result = UpdateIncidentSchema.safeParse(update);
      expect(result.success).toBe(false);
    });
  });

  describe('CreateTimelineEventSchema', () => {
    it('should validate a valid timeline event', () => {
      const event = {
        timestamp: '2026-01-09T12:00:00Z',
        description: 'Alert triggered',
        author: 'monitoring-bot',
      };

      const result = CreateTimelineEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });

    it('should require all fields', () => {
      const incomplete = {
        timestamp: '2026-01-09T12:00:00Z',
        // missing description and author
      };

      const result = CreateTimelineEventSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });
  });

  describe('CreateActionItemSchema', () => {
    it('should validate a valid action item', () => {
      const action = {
        title: 'Add monitoring',
        owner: 'oncall@example.com',
        status: 'open',
      };

      const result = CreateActionItemSchema.safeParse(action);
      expect(result.success).toBe(true);
    });

    it('should allow optional dueDate', () => {
      const action = {
        title: 'Add monitoring',
        owner: 'oncall@example.com',
        status: 'open',
        dueDate: '2026-01-15T00:00:00.000Z',
      };

      const result = CreateActionItemSchema.safeParse(action);
      expect(result.success).toBe(true);
    });

    it('should validate status enum', () => {
      const statuses = ['open', 'in_progress', 'done'];
      
      for (const status of statuses) {
        const action = {
          title: 'Test',
          owner: 'test',
          status,
        };
        const result = CreateActionItemSchema.safeParse(action);
        expect(result.success).toBe(true);
      }
    });
  });
});

