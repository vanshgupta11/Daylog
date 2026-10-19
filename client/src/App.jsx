import { useAuth } from './context/AuthContext';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-loader">
        <span className="auth-spinner" aria-label="Loading" />
        Loading Daylog…
      </div>
    );
  }

  return user ? <Dashboard /> : <AuthPage />;
}
