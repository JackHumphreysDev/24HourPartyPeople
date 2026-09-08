import { useEffect, useState, type FormEvent } from 'react';

import { getRegistrationPlayers } from './auth/api';
import type { RegistrationPlayer } from './auth/types';
import { useAuth } from './auth/useAuth';

type AuthMode = 'login' | 'register';

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The request could not be completed.';
}

export function AuthScreen() {
  const { login, registerPlayer } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [players, setPlayers] = useState<RegistrationPlayer[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (mode !== 'register') {
      return;
    }
    let isCurrentRequest = true;
    void getRegistrationPlayers()
      .then((nextPlayers) => {
        if (!isCurrentRequest) return;
        setPlayers(nextPlayers);
        setPlayerId((current) => current || nextPlayers[0]?.id || '');
      })
      .catch((requestError: unknown) => {
        if (isCurrentRequest) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (isCurrentRequest) setPlayersLoading(false);
      });
    return () => {
      isCurrentRequest = false;
    };
  }, [mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'register') {
        await registerPlayer({ name, email, password, playerId });
      } else {
        await login({ email, password });
      }
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setPlayersLoading(nextMode === 'register');
  }

  return (
    <section className="auth-card" aria-labelledby="auth-heading">
      <div className="auth-tabs" aria-label="Account access">
        <button
          className={mode === 'login' ? 'auth-tab auth-tab-active' : 'auth-tab'}
          type="button"
          onClick={() => changeMode('login')}
        >
          Sign in
        </button>
        <button
          className={
            mode === 'register' ? 'auth-tab auth-tab-active' : 'auth-tab'
          }
          type="button"
          onClick={() => changeMode('register')}
        >
          Create player account
        </button>
      </div>

      <div className="auth-copy">
        <p className="eyebrow">Secure team access</p>
        <h2 id="auth-heading">
          {mode === 'login' ? 'Sign in' : 'Create your account'}
        </h2>
        <p>
          {mode === 'login'
            ? 'Use your 24 Hour Party People account.'
            : 'Select your Player profile. An administrator will approve the link.'}
        </p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {mode === 'register' && (
          <label>
            Name
            <input
              autoComplete="name"
              maxLength={100}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        )}

        <label>
          Email
          <input
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label>
          Password
          <input
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            minLength={12}
            maxLength={128}
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {mode === 'register' && (
            <span className="field-hint">Use at least 12 characters.</span>
          )}
        </label>

        {mode === 'register' && (
          <label>
            Your Player profile
            <select
              disabled={playersLoading || players.length === 0}
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
            {playersLoading ? (
              <span className="field-hint">Loading available players…</span>
            ) : players.length === 0 ? (
              <span className="field-hint">
                No unclaimed active Player profiles are available.
              </span>
            ) : (
              <span className="field-hint">
                Your selection remains pending until an administrator approves
                it.
              </span>
            )}
          </label>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button
          className="primary-button"
          disabled={
            isSubmitting ||
            (mode === 'register' && (playersLoading || !playerId))
          }
          type="submit"
        >
          {isSubmitting
            ? 'Please wait…'
            : mode === 'login'
              ? 'Sign in'
              : 'Create player account'}
        </button>
      </form>
    </section>
  );
}
