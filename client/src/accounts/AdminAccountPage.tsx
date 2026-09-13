import { AuthScreen } from '../AuthScreen';
import { AdminNavigation } from '../admin/AdminNavigation';
import { useAuth } from '../auth/useAuth';
import { AccountSettingsForm } from './AccountSettingsForm';

export function AdminAccountPage() {
  const { status, updateAdminAccount, user } = useAuth();
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
      <AccountSettingsForm
        kind="Administrator"
        updateAccount={updateAdminAccount}
      />
    </>
  );
}
