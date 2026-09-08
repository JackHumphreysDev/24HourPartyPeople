import { useState, type FormEvent } from 'react';

import { AuthScreen } from '../AuthScreen';
import { AdminNavigation } from '../admin/AdminNavigation';
import { useAuth } from '../auth/useAuth';

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The account could not be updated.';
}

function AccountSettings() {
  const { updateAdminAccount, user } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      await updateAdminAccount({
        currentPassword,
        email,
        name,
        newPassword: newPassword || null,
      });
      setCurrentPassword('');
      setNewPassword('');
      setSuccess('Administrator account updated successfully.');
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="content-section account-settings">
      <div className="section-heading">
        <p className="eyebrow">Administrator</p>
        <h2>My account</h2>
        <p>Update your administrator name, email, or password.</p>
      </div>
      <form className="auth-form" onSubmit={handleSubmit}>
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
        <label>
          Email
          <input
            autoComplete="email"
            maxLength={254}
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Current password
          <input
            autoComplete="current-password"
            minLength={12}
            maxLength={128}
            required
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </label>
        <label>
          New password <span className="field-hint">Optional</span>
          <input
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>
        {success && <p className="form-success">{success}</p>}
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
          {isSubmitting ? 'Saving…' : 'Save account'}
        </button>
      </form>
    </section>
  );
}

export function AdminAccountPage() {
  const { status, user } = useAuth();
  if (status === 'loading')
    return <p className="status-panel">Checking your session…</p>;
  if (status === 'anonymous') return <AuthScreen />;
  if (user?.role !== 'ADMIN') {
    return (
      <p className="status-panel status-panel-error">
        Administrator access is required.
      </p>
    );
  }
  return (
    <>
      <AdminNavigation />
      <AccountSettings />
    </>
  );
}
