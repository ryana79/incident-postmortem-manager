import { HttpRequest } from '@azure/functions';

export interface AuthUser {
  userId: string;
  userDetails: string;
  identityProvider: string;
  userRoles: string[];
}

/**
 * Extract user info from Azure Static Web Apps authentication headers
 * SWA passes the user info via x-ms-client-principal header
 */
export function getAuthUser(req: HttpRequest): AuthUser | null {
  const header = req.headers.get('x-ms-client-principal');
  
  if (!header) {
    return null;
  }

  try {
    const decoded = Buffer.from(header, 'base64').toString('utf-8');
    const principal = JSON.parse(decoded);
    
    return {
      userId: principal.userId || 'anonymous',
      userDetails: principal.userDetails || 'anonymous',
      identityProvider: principal.identityProvider || 'anonymous',
      userRoles: principal.userRoles || [],
    };
  } catch {
    return null;
  }
}

/**
 * Get the tenant ID for the current user (used for data partitioning)
 * For this demo, we use a shared 'default' tenant so all users can see all data.
 * In a production multi-tenant app, you would return a user/org-specific tenant ID.
 */
export function getTenantId(_req: HttpRequest): string {
  // For demo purposes, use a shared tenant so all incidents are visible to everyone
  // To enable multi-tenancy, uncomment the code below:
  // const user = getAuthUser(req);
  // if (user && user.userId !== 'anonymous') {
  //   return `${user.identityProvider}_${user.userId}`.substring(0, 50);
  // }
  
  return 'default';
}

/**
 * Get the username for audit logging
 */
export function getUsername(req: HttpRequest): string {
  const user = getAuthUser(req);
  return user?.userDetails || 'anonymous';
}

/**
 * Check if user has a specific role
 */
export function hasRole(req: HttpRequest, role: string): boolean {
  const user = getAuthUser(req);
  return user?.userRoles.includes(role) || false;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(req: HttpRequest): boolean {
  const user = getAuthUser(req);
  return user !== null && user.userId !== 'anonymous';
}

