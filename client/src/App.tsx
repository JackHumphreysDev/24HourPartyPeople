import './styles.css';

import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';

import { HomePage } from './HomePage';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/useAuth';
import { AdminPlayersPage } from './players/AdminPlayersPage';
import { PlayerProfilePage } from './players/PlayerProfilePage';
import { PlayersPage } from './players/PlayersPage';

function NotFoundPage() {
  return (
    <section className="status-panel">
      <h2>Page not found</h2>
      <NavLink to="/">Return home</NavLink>
    </section>
  );
}

function AppContent() {
  const { logout, status, user } = useAuth();

  return (
    <main className="app-shell">
      <div className="page-frame">
        <header className="team-header">
          <div>
            <p className="eyebrow">6-a-side football · Sheffield</p>
            <h1 id="team-name">24 Hour Party People</h1>
          </div>
          <nav className="site-nav" aria-label="Main navigation">
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/players">Players</NavLink>
            <NavLink to="/admin">Admin</NavLink>
            {status === 'authenticated' && user && (
              <button type="button" onClick={() => void logout()}>
                Sign out {user.name}
              </button>
            )}
          </nav>
        </header>

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/players/:playerId" element={<PlayerProfilePage />} />
          <Route path="/admin" element={<AdminPlayersPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </main>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
