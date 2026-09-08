import { useEffect, useState, type FormEvent } from 'react';
import { NavLink } from 'react-router-dom';

import { AuthScreen } from '../AuthScreen';
import { useAuth } from '../auth/useAuth';
import { getAdminTeamProfile, updateTeamProfile } from './api';

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The team description could not be saved.';
}

function TeamDescriptionEditor() {
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCurrentRequest = true;

    void getAdminTeamProfile()
      .then((teamProfile) => {
        if (isCurrentRequest) {
          setDescription(teamProfile.description);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (isCurrentRequest) {
          setStatus('error');
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const teamProfile = await updateTeamProfile(description);
      setDescription(teamProfile.description);
      setSuccessMessage('The Home page description has been updated.');
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="content-section home-admin-page">
      <div className="section-heading">
        <p className="eyebrow">Home page</p>
        <h2>Team description</h2>
        <p>Update the introduction displayed above the current squad.</p>
      </div>

      {status === 'loading' && (
        <p className="status-panel">Loading team description…</p>
      )}
      {status === 'error' && (
        <p className="status-panel status-panel-error" role="alert">
          The team description could not be loaded.
        </p>
      )}
      {status === 'ready' && (
        <form className="team-description-form" onSubmit={handleSubmit}>
          <label htmlFor="team-description">Description</label>
          <textarea
            id="team-description"
            maxLength={2000}
            required
            rows={7}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <p className="form-hint">{description.length} / 2,000 characters</p>
          {successMessage && (
            <p className="form-success" role="status">
              {successMessage}
            </p>
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
            {isSubmitting ? 'Saving…' : 'Save description'}
          </button>
        </form>
      )}
    </section>
  );
}

export function AdminHomePage() {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return <p className="auth-loading">Checking your session…</p>;
  }

  if (status !== 'authenticated' || user?.role !== 'ADMIN') {
    return <AuthScreen />;
  }

  return (
    <>
      <nav className="admin-nav" aria-label="Administrator sections">
        <NavLink to="/admin/home-page">Home page</NavLink>
        <NavLink to="/admin" end>
          Players
        </NavLink>
        <NavLink to="/admin/statistics">Seasons &amp; statistics</NavLink>
        <NavLink to="/admin/standings">Standings</NavLink>
        <NavLink to="/admin/fixtures">Fixtures</NavLink>
        <NavLink to="/admin/games">Results</NavLink>
        <NavLink to="/admin/club-history">Club history</NavLink>
      </nav>
      <TeamDescriptionEditor />
    </>
  );
}
