import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const { signup, signin } = useAuth();
  const [tab,      setTab]      = useState('signin'); // 'signin' | 'signup'
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const reset = (t) => { setTab(t); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'signup') {
        if (!name.trim()) { setError('Please enter your name'); setLoading(false); return; }
        await signup(name.trim(), email.trim(), password);
      } else {
        await signin(email.trim(), password);
      }
      // AuthContext will update user → App redirects automatically
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Brand */}
        <div className="auth-brand">
          <svg width="32" height="32" viewBox="0 0 22 22" aria-hidden="true">
            <rect x="1" y="1" width="9" height="9" rx="2" fill="#7c6cff"/>
            <rect x="12" y="1" width="9" height="9" rx="2" fill="#7c6cff" opacity=".55"/>
            <rect x="1" y="12" width="9" height="9" rx="2" fill="#7c6cff" opacity=".25"/>
            <rect x="12" y="12" width="9" height="9" rx="2" fill="#7c6cff" opacity=".8"/>
          </svg>
          <div>
            <div className="auth-brand-name">Daylog</div>
            <div className="auth-brand-tagline">Habit &amp; Skill Tracker</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="auth-tabs" role="tablist">
          <button
            className={`auth-tab${tab === 'signin' ? ' active' : ''}`}
            onClick={() => reset('signin')}
            role="tab"
            aria-selected={tab === 'signin'}
            id="tab-signin"
            aria-controls="panel-signin"
          >Sign in</button>
          <button
            className={`auth-tab${tab === 'signup' ? ' active' : ''}`}
            onClick={() => reset('signup')}
            role="tab"
            aria-selected={tab === 'signup'}
            id="tab-signup"
            aria-controls="panel-signup"
          >Create account</button>
        </div>

        {/* Form */}
        <form
          className="auth-form"
          onSubmit={handleSubmit}
          id={tab === 'signin' ? 'panel-signin' : 'panel-signup'}
          aria-labelledby={tab === 'signin' ? 'tab-signin' : 'tab-signup'}
          noValidate
        >
          {tab === 'signup' && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-name">Full name</label>
              <input
                id="auth-name"
                className={`auth-input${error && !name.trim() ? ' error' : ''}`}
                type="text"
                placeholder="Jane Smith"
                autoComplete="name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              className="auth-input"
              type="email"
              placeholder="jane@example.com"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-password">
              Password{tab === 'signup' && <span style={{ color: 'var(--fg3)', fontWeight: 400 }}> — min 6 chars</span>}
            </label>
            <input
              id="auth-password"
              className="auth-input"
              type="password"
              placeholder={tab === 'signup' ? 'Create a password' : 'Your password'}
              autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="auth-error" role="alert">{error}</div>}

          <button className="auth-submit" type="submit" id="auth-submit-btn" disabled={loading}>
            {loading && <span className="auth-spinner" aria-hidden="true" />}
            {loading ? 'Please wait…' : tab === 'signin' ? 'Sign in to Daylog' : 'Create my account'}
          </button>
        </form>
      </div>
    </div>
  );
}
