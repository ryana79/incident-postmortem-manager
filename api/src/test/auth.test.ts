// ─────────────────────────────────────────────────────────────────────────────
// Unit Tests: Authentication Module
// ─────────────────────────────────────────────────────────────────────────────

import { HttpRequest } from '@azure/functions';
import { getAuthUser, getTenantId, getUsername, hasRole, isAuthenticated } from '../auth';

// Mock HttpRequest factory
function createMockRequest(clientPrincipal?: object): HttpRequest {
  const headers = new Map<string, string>();
  
  if (clientPrincipal) {
    const encoded = Buffer.from(JSON.stringify(clientPrincipal)).toString('base64');
    headers.set('x-ms-client-principal', encoded);
  }

  return {
    headers: {
      get: (name: string) => headers.get(name.toLowerCase()) || null,
    },
  } as unknown as HttpRequest;
}

describe('Auth Module', () => {
  describe('getAuthUser', () => {
    it('should return null when no auth header', () => {
      const req = createMockRequest();
      const user = getAuthUser(req);
      expect(user).toBeNull();
    });

    it('should parse valid client principal', () => {
      const principal = {
        userId: 'user123',
        userDetails: 'test@example.com',
        identityProvider: 'aad',
        userRoles: ['authenticated', 'admin'],
      };
      
      const req = createMockRequest(principal);
      const user = getAuthUser(req);
      
      expect(user).toEqual(principal);
    });

    it('should handle missing userRoles', () => {
      const principal = {
        userId: 'user123',
        userDetails: 'test@example.com',
        identityProvider: 'aad',
      };
      
      const req = createMockRequest(principal);
      const user = getAuthUser(req);
      
      expect(user?.userRoles).toEqual([]);
    });

    it('should return null for invalid base64', () => {
      const req = {
        headers: {
          get: () => 'invalid-base64!!!',
        },
      } as unknown as HttpRequest;
      
      const user = getAuthUser(req);
      expect(user).toBeNull();
    });
  });

  describe('getTenantId', () => {
    it('should return default for unauthenticated users', () => {
      const req = createMockRequest();
      const tenantId = getTenantId(req);
      expect(tenantId).toBe('default');
    });

    it('should return tenant ID based on user', () => {
      const principal = {
        userId: 'user123',
        userDetails: 'test@example.com',
        identityProvider: 'aad',
        userRoles: ['authenticated'],
      };
      
      const req = createMockRequest(principal);
      const tenantId = getTenantId(req);
      
      expect(tenantId).toBe('aad_user123');
    });

    it('should truncate long tenant IDs', () => {
      const principal = {
        userId: 'a'.repeat(100),
        userDetails: 'test@example.com',
        identityProvider: 'azure_active_directory_very_long_name',
        userRoles: [],
      };
      
      const req = createMockRequest(principal);
      const tenantId = getTenantId(req);
      
      expect(tenantId.length).toBeLessThanOrEqual(50);
    });
  });

  describe('getUsername', () => {
    it('should return anonymous for unauthenticated users', () => {
      const req = createMockRequest();
      const username = getUsername(req);
      expect(username).toBe('anonymous');
    });

    it('should return userDetails when authenticated', () => {
      const principal = {
        userId: 'user123',
        userDetails: 'john.doe@example.com',
        identityProvider: 'aad',
        userRoles: ['authenticated'],
      };
      
      const req = createMockRequest(principal);
      const username = getUsername(req);
      
      expect(username).toBe('john.doe@example.com');
    });
  });

  describe('hasRole', () => {
    it('should return false for unauthenticated users', () => {
      const req = createMockRequest();
      expect(hasRole(req, 'admin')).toBe(false);
    });

    it('should return true when user has role', () => {
      const principal = {
        userId: 'user123',
        userDetails: 'admin@example.com',
        identityProvider: 'aad',
        userRoles: ['authenticated', 'admin'],
      };
      
      const req = createMockRequest(principal);
      expect(hasRole(req, 'admin')).toBe(true);
    });

    it('should return false when user lacks role', () => {
      const principal = {
        userId: 'user123',
        userDetails: 'user@example.com',
        identityProvider: 'aad',
        userRoles: ['authenticated'],
      };
      
      const req = createMockRequest(principal);
      expect(hasRole(req, 'admin')).toBe(false);
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no auth header', () => {
      const req = createMockRequest();
      expect(isAuthenticated(req)).toBe(false);
    });

    it('should return true for authenticated users', () => {
      const principal = {
        userId: 'user123',
        userDetails: 'user@example.com',
        identityProvider: 'aad',
        userRoles: ['authenticated'],
      };
      
      const req = createMockRequest(principal);
      expect(isAuthenticated(req)).toBe(true);
    });

    it('should return false for anonymous userId', () => {
      const principal = {
        userId: 'anonymous',
        userDetails: 'anonymous',
        identityProvider: 'anonymous',
        userRoles: [],
      };
      
      const req = createMockRequest(principal);
      expect(isAuthenticated(req)).toBe(false);
    });
  });
});

