import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Dashboard: embeds the Daylog tracker in a full-height iframe.
 * Profile + sign-out live inside the tracker's own sidebar via postMessage.
 *
 * Flow:
 *  1. Iframe loads → parent sends { type: 'daylog:auth', user: {...} }
 *  2. Tracker sidebar shows real name/email + Sign out button
 *  3. User clicks Sign out in sidebar → iframe sends { type: 'daylog:logout' }
 *  4. Parent receives it → calls logout() → redirects to auth page
 */
export default function Dashboard() {
  const { user, logout } = useAuth();
  const iframeRef = useRef(null);

  const trackerUrl = `/tracker?uid=${encodeURIComponent(user?._id || '')}`;

  // ── Send auth info into the iframe once it has loaded ──────────────────────
  const pushAuth = () => {
    const frame = iframeRef.current;
    if (!frame || !user) return;
    frame.contentWindow.postMessage(
      {
        type: 'daylog:auth',
        user: {
          name:  user.name  || '',
          email: user.email || '',
          id:    user._id   || '',
        },
      },
      window.location.origin
    );
  };

  // ── Listen for logout request from the iframe ──────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'daylog:logout') {
        logout();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [logout]);

  return (
    <div className="dashboard">
      <iframe
        ref={iframeRef}
        className="tracker-frame"
        src={trackerUrl}
        title="Daylog Habit Tracker"
        allow="fullscreen"
        id="tracker-iframe"
        onLoad={pushAuth}
      />
    </div>
  );
}
