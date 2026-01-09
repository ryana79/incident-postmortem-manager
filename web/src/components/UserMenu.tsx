import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export default function UserMenu() {
  const { user, loading, login, logout, isAuthenticated } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  if (loading) {
    return <div className="user-menu-skeleton" />;
  }

  if (!isAuthenticated) {
    return (
      <button className="btn btn-primary btn-sm" onClick={login}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
        </svg>
        Sign In
      </button>
    );
  }

  const initials = user?.userDetails
    ?.split('@')[0]
    ?.slice(0, 2)
    ?.toUpperCase() || '??';

  return (
    <div className="user-menu" style={{ position: 'relative' }}>
      <button
        className="user-avatar"
        onClick={() => setShowMenu(!showMenu)}
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent-start), var(--accent-end))',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.75rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {initials}
      </button>

      {showMenu && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99,
            }}
            onClick={() => setShowMenu(false)}
          />
          <div
            className="user-dropdown"
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '0.5rem',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '0.5rem',
              minWidth: '200px',
              zIndex: 100,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '0.5rem' }}>
              <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>{user?.userDetails}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                via {user?.identityProvider === 'aad' ? 'Microsoft' : user?.identityProvider}
              </div>
            </div>
            <button
              onClick={logout}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--danger)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = 'var(--danger-muted)')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

