import './styles.css';

import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';

import { HomePage } from './HomePage';
import { AccountPage } from './accounts/AccountPage';
import { AdminAccountPage } from './accounts/AdminAccountPage';
import { AdminAccountsPage } from './accounts/AdminAccountsPage';
import { AuthProvider } from './auth/AuthProvider';
import { canManageContent, canUsePlayerProfile } from './auth/permissions';
import { useAuth } from './auth/useAuth';
import { AdminClubHistoryPage } from './club-history/AdminClubHistoryPage';
import { ClubHistoryPage } from './club-history/ClubHistoryPage';
import { AdminFixturesPage } from './fixtures/AdminFixturesPage';
import { FixturesPage } from './fixtures/FixturesPage';
import { AdminGamePage } from './games/AdminGamePage';
import { GameHistoryPage } from './games/GameHistoryPage';
import { AdminHomePage } from './home/AdminHomePage';
import { AdminPlayersPage } from './players/AdminPlayersPage';
import { AdminStatisticsPage } from './players/AdminStatisticsPage';
import { PlayerProfilePage } from './players/PlayerProfilePage';
import { PlayersPage } from './players/PlayersPage';
import { StatisticsHubPage } from './players/StatisticsHubPage';
import { AdminStandingsPage } from './standings/AdminStandingsPage';
import { StandingsPage } from './standings/StandingsPage';

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
      <header className="team-header">
        <div className="team-header-inner">
          <div className="team-brand">
            <img
              className="team-brand-logo"
              src="/assets/brand/logo-transparent-512.png"
              alt="24 Hour Party People club crest"
            />
            <div className="team-brand-copy">
              <h1 id="team-name">24 Hour Party People</h1>
              <p className="eyebrow">6-a-side football · Sheffield</p>
            </div>
          </div>
          <nav className="site-nav" aria-label="Main navigation">
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/players">Players</NavLink>
            <NavLink to="/statistics">Statistics</NavLink>
            <NavLink to="/standings">Standings</NavLink>
            <NavLink to="/fixtures">Fixtures</NavLink>
            <NavLink to="/games">Games</NavLink>
            <NavLink to="/club-history">History</NavLink>
            {canManageContent(user) && <NavLink to="/admin">Admin</NavLink>}
            {user?.role !== 'ADMIN' && (
              <>
                {canUsePlayerProfile(user) && user?.playerId && (
                  <NavLink to={`/players/${user.playerId}`}>My profile</NavLink>
                )}
                <NavLink to="/account">
                  {status === 'authenticated' ? 'Account' : 'Sign in'}
                </NavLink>
              </>
            )}
            {status === 'authenticated' && user && (
              <button type="button" onClick={() => void logout()}>
                Sign out {user.name}
              </button>
            )}
          </nav>
        </div>
      </header>

      <div className="page-frame">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/players/:playerId" element={<PlayerProfilePage />} />
          <Route path="/statistics" element={<StatisticsHubPage />} />
          <Route path="/standings" element={<StandingsPage />} />
          <Route path="/fixtures" element={<FixturesPage />} />
          <Route path="/games" element={<GameHistoryPage />} />
          <Route path="/club-history" element={<ClubHistoryPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/admin" element={<AdminPlayersPage />} />
          <Route path="/admin/account" element={<AdminAccountPage />} />
          <Route path="/admin/accounts" element={<AdminAccountsPage />} />
          <Route path="/admin/home-page" element={<AdminHomePage />} />
          <Route path="/admin/statistics" element={<AdminStatisticsPage />} />
          <Route path="/admin/standings" element={<AdminStandingsPage />} />
          <Route path="/admin/fixtures" element={<AdminFixturesPage />} />
          <Route path="/admin/games" element={<AdminGamePage />} />
          <Route
            path="/admin/club-history"
            element={<AdminClubHistoryPage />}
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <span>Local football. Proper mates.</span>
          <span className="site-footer-rule" aria-hidden="true" />
          <span>24 Hour Party People</span>
          <span className="site-footer-rule" aria-hidden="true" />
          <span>Sheffield. Always</span>
        </div>
      </footer>
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
