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
  );
}
