import { useAuth } from '../context/AuthContext';
import AuthBar from './AuthBar';

/**
 * Dashboard: shows the AuthBar + embeds the Daylog tracker in an iframe.
 * The tracker runs at /tracker (served by Express from the public/ folder).
 */
export default function Dashboard() {
  const { user } = useAuth();

  // Pass the userId as a query param so the tracker can scope its API calls
  const trackerUrl = `/tracker?uid=${encodeURIComponent(user?._id || '')}`;

  return (
    <div className="dashboard">
      <AuthBar />
      <iframe
        className="tracker-frame"
        src={trackerUrl}
        title="Daylog Habit Tracker"
        allow="fullscreen"
        id="tracker-iframe"
      />
    </div>
  );
}
