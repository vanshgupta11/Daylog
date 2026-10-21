import { useAuth } from '../context/AuthContext';

/**
 * Top bar shown when the user is authenticated, above the tracker iframe.
 */
export default function AuthBar() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const initials = user.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const handleLogout = async () => {
    if (window.confirm('Sign out of Daylog?')) {
      await logout();
    }
  };

  return (
    <div className="auth-bar" role="banner">
      <div className="auth-bar-brand" style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
          <rect x="1" y="1" width="9" height="9" rx="2.5" fill="#7c6cff" />
          <rect x="12" y="1" width="9" height="9" rx="2.5" fill="#7c6cff" opacity=".55" />
          <rect x="1" y="12" width="9" height="9" rx="2.5" fill="#7c6cff" opacity=".25" />
          <rect x="12" y="12" width="9" height="9" rx="2.5" fill="#7c6cff" opacity=".8" />
        </svg>
        <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.3px', color: 'var(--fg)' }}>Daylog</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div className="auth-bar-left">
          <div className="auth-bar-avatar" aria-hidden="true">{initials}</div>
          <div>
            <div className="auth-bar-name">{user.name}</div>
            <div className="auth-bar-email">{user.email}</div>
          </div>
        </div>
        <button
          className="auth-bar-logout"
          id="logout-btn"
          onClick={handleLogout}
          title="Sign out"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
