import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { clearAuthCache } from '../api';

export interface User {
  userId: string;
  userDetails: string;
  identityProvider: string;
  userRoles: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => void;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const response = await fetch('/.auth/me');
      if (response.ok) {
        const data = await response.json();
        if (data.clientPrincipal) {
          setUser({
            userId: data.clientPrincipal.userId,
            userDetails: data.clientPrincipal.userDetails,
            identityProvider: data.clientPrincipal.identityProvider,
            userRoles: data.clientPrincipal.userRoles || [],
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    } finally {
      setLoading(false);
    }
  }

  function login() {
    // Redirect to Azure AD login
    window.location.href = '/.auth/login/aad?post_login_redirect_uri=' + encodeURIComponent(window.location.pathname);
  }

  function logout() {
    clearAuthCache(); // Clear cached auth token
    window.location.href = '/.auth/logout?post_logout_redirect_uri=' + encodeURIComponent('/');
  }

  const isAuthenticated = user !== null;
  const isAdmin = user?.userRoles.includes('admin') || false;

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

