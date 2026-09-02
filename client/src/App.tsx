import './styles.css';

import { AuthScreen } from './AuthScreen';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/useAuth';

function AppContent() {
  const { logout, status, user } = useAuth();

  return (
    <main className="app-shell">
      <div className="page-frame">
        <header className="team-header">
          <p className="eyebrow">6-a-side football · Sheffield</p>
          <h1 id="team-name">24 Hour Party People</h1>
        </header>

        {status === 'loading' && (
          <section className="auth-card auth-loading" aria-live="polite">
            Checking your session…
          </section>
        )}

        {status === 'anonymous' && <AuthScreen />}

        {status === 'authenticated' && user && (
          <section className="auth-card signed-in-card">
            <p className="eyebrow">Administrator access active</p>
            <h2>Welcome, {user.name}</h2>
            <p>{user.email}</p>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void logout()}
            >
              Sign out
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
