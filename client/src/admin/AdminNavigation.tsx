import { NavLink } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';

export function AdminNavigation() {
  const { user } = useAuth();
  const isOwnerAdmin = user?.role === 'ADMIN';

  return (
    <nav className="admin-nav" aria-label="Administrator sections">
      <NavLink to="/admin/home-page">Home page</NavLink>
      <NavLink to="/admin" end>
        Players
      </NavLink>
      <NavLink to="/admin/statistics">Seasons &amp; statistics</NavLink>
      {isOwnerAdmin ? (
        <>
          <NavLink to="/admin/standings">Standings</NavLink>
          <NavLink to="/admin/fixtures">Fixtures</NavLink>
          <NavLink to="/admin/games">Results</NavLink>
          <NavLink to="/admin/club-history">Club history</NavLink>
          <NavLink to="/admin/accounts">Accounts</NavLink>
          <NavLink to="/admin/account">My account</NavLink>
        </>
      ) : (
        <NavLink to="/account">My account</NavLink>
      )}
    </nav>
  );
}
