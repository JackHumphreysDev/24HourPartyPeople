import { useEffect, useState, type FormEvent } from 'react';
import { NavLink } from 'react-router-dom';

import { AuthScreen } from '../AuthScreen';
import { getRegistrationPlayers } from '../auth/api';
import type { RegistrationPlayer } from '../auth/types';
import { useAuth } from '../auth/useAuth';

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The profile request could not be completed.';
}

export function AccountPage() {
  const { requestPlayerProfile, status, user } = useAuth();
  const [players, setPlayers] = useState<RegistrationPlayer[]>([]);
  const [playerId, setPlayerId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (
      status !== 'authenticated' ||
      user?.role !== 'PLAYER' ||
      user.playerId ||
      user.requestedPlayerId
    ) {
      return;
    }
    void getRegistrationPlayers()
      .then((nextPlayers) => {
        setPlayers(nextPlayers);
        setPlayerId(nextPlayers[0]?.id ?? '');
      })
      .catch((requestError: unknown) => setError(errorMessage(requestError)));
  }, [status, user]);

  if (status === 'loading')
    return <p className="status-panel">Checking your session…</p>;
  if (status === 'anonymous') return <AuthScreen />;
  if (!user) return null;
  if (user.role === 'ADMIN') {
    return (
      <section className="content-section">
        <h2>Administrator account</h2>
        <NavLink className="primary-link" to="/admin/account">
          Manage my account
        </NavLink>
      </section>
    );
  }
  if (user.playerId) {
    return (
      <section className="content-section account-status">
        <p className="eyebrow">Player account</p>
        <h2>Welcome, {user.name}</h2>
        <p>Your account is linked to your Player profile.</p>
        <NavLink className="primary-link" to={`/players/${user.playerId}`}>
          View my profile
        </NavLink>
      </section>
    );
  }
  if (user.requestedPlayerId) {
    return (
      <section className="content-section account-status">
        <p className="eyebrow">Player account</p>
        <h2>Profile request pending</h2>
        <p>An administrator needs to approve your selected Player profile.</p>
      </section>
    );
  }

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await requestPlayerProfile(playerId);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="content-section account-status">
      <p className="eyebrow">Player account</p>
      <h2>Request a Player profile</h2>
      <p>
        Your previous request was not approved. You can choose another available
        profile.
      </p>
      <form className="auth-form" onSubmit={handleRequest}>
        <label>
          Player profile
          <select
            disabled={players.length === 0}
            required
            value={playerId}
            onChange={(event) => setPlayerId(event.target.value)}
          >
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name} · {player.position}
              </option>
            ))}
          </select>
        </label>
        {players.length === 0 && (
          <p className="status-panel">No profiles are currently available.</p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary-button"
          disabled={isSubmitting || !playerId}
          type="submit"
        >
          {isSubmitting ? 'Sending…' : 'Request profile'}
        </button>
      </form>
    </section>
  );
}
