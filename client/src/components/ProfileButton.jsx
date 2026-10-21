import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function ProfileButton() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  if (!user) return null;

  const initials = user.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user.email ? user.email.slice(0, 2).toUpperCase() : '?';

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const handleLogout = async () => {
    if (window.confirm('Sign out of Daylog?')) {
      setOpen(false);
      await logout();
    }
  };

  return (
    <div className="profile-btn-container" ref={containerRef}>
      {/* Backdrop overlay to capture clicks outside over iframe */}
      {open && (
        <div
          className="profile-backdrop"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Floating profile trigger button */}
      <button
        type="button"
        className={`profile-trigger-btn${open ? ' active' : ''}`}
        onClick={() => setOpen(prev => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        id="profile-button"
        title={`${user.name || user.email} — Profile`}
      >
        <div className="profile-avatar" aria-hidden="true">{initials}</div>
        <span className="profile-trigger-name">{user.name ? user.name.split(' ')[0] : 'Profile'}</span>
        <svg
          className={`profile-chevron${open ? ' rotated' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2.5 4.5l3.5 3.5 3.5-3.5" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="profile-popover" role="menu" aria-orientation="vertical" aria-labelledby="profile-button">
          <div className="profile-popover-header">
            <div className="profile-avatar large" aria-hidden="true">{initials}</div>
            <div className="profile-user-info">
              <div className="profile-user-name">{user.name || 'Daylog User'}</div>
              <div className="profile-user-email">{user.email}</div>
            </div>
          </div>

          <div className="profile-badge-row">
            <span className="profile-status-dot" />
            <span className="profile-badge-text">Daylog Account • Active</span>
          </div>

          <div className="profile-divider" />

          <button
            type="button"
            className="profile-logout-btn"
            id="profile-logout-btn"
            onClick={handleLogout}
            role="menuitem"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
