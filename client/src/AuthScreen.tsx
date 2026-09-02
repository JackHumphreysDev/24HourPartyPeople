import { useState, type FormEvent } from 'react';

import { useAuth } from './auth/useAuth';

type AuthMode = 'login' | 'setup';

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The request could not be completed.';
}

export function AuthScreen() {
  const { login, registerAdmin } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'setup') {
        await registerAdmin({ name, email, password, setupKey });
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
          className={mode === 'setup' ? 'auth-tab auth-tab-active' : 'auth-tab'}
          type="button"
          onClick={() => changeMode('setup')}
        >
          Set up administrator
        </button>
      </div>

      <div className="auth-copy">
        <p className="eyebrow">Secure team access</p>
        <h2 id="auth-heading">
          {mode === 'login' ? 'Sign in' : 'Create the administrator'}
        </h2>
        <p>
          {mode === 'login'
            ? 'Use your 24 Hour Party People account.'
            : 'Available once, for the site owner, before any account exists.'}
        </p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {mode === 'setup' && (
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
          {mode === 'setup' && (
            <span className="field-hint">Use at least 12 characters.</span>
          )}
        </label>

        {mode === 'setup' && (
          <label>
            Administrator setup key
            <input
              autoComplete="off"
              required
              type="password"
              value={setupKey}
              onChange={(event) => setSetupKey(event.target.value)}
            />
          </label>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button
          className="primary-button"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting
            ? 'Please wait…'
            : mode === 'login'
              ? 'Sign in'
              : 'Create administrator'}
        </button>
      </form>
    </section>
  );
}
