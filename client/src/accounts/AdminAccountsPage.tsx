import { useEffect, useState } from 'react';

import { AuthScreen } from '../AuthScreen';
import { AdminNavigation } from '../admin/AdminNavigation';
import { useAuth } from '../auth/useAuth';
import {
  approveClaim,
  assignPlayer,
  getAdminAccounts,
  rejectClaim,
} from './api';
import type { AccountsSnapshot } from './types';

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The account request could not be completed.';
}

function AccountsManager() {
  const [snapshot, setSnapshot] = useState<AccountsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);

  async function loadAccounts() {
    setSnapshot(await getAdminAccounts());
  }

  useEffect(() => {
    void getAdminAccounts()
      .then(setSnapshot)
      .catch((loadError: unknown) => {
        setError(errorMessage(loadError));
      });
  }, []);

  async function runAction(
    accountId: string,
    action: () => Promise<unknown>,
    message: string,
  ) {
    setBusyAccountId(accountId);
    setError(null);
    setSuccess(null);
    try {
      await action();
      await loadAccounts();
      setSuccess(message);
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setBusyAccountId(null);
    }
  }

  if (!snapshot && !error) {
    return <p className="status-panel">Loading player accounts…</p>;
  }

  const accounts = snapshot?.accounts ?? [];
  const pendingAccounts = accounts.filter((account) => account.requestedPlayer);

  return (
    <section className="content-section account-management">
      <div className="section-heading">
        <p className="eyebrow">Administrator</p>
        <h2>Player accounts</h2>
        <p>Approve profile requests or assign an account manually.</p>
      </div>

      {pendingAccounts.length > 0 && (
        <div className="account-section">
          <h3>Pending profile requests</h3>
          <div className="account-list">
            {pendingAccounts.map((account) => (
              <article className="account-card" key={account.id}>
                <div>
                  <strong>{account.name}</strong>
                  <span>{account.email}</span>
                  <span>Requests {account.requestedPlayer!.name}</span>
                </div>
                <div className="account-actions">
                  <button
                    className="primary-button"
                    disabled={busyAccountId === account.id}
                    type="button"
                    onClick={() =>
                      void runAction(
                        account.id,
                        () => approveClaim(account.id),
                        `${account.name}'s profile request was approved.`,
                      )
                    }
                  >
                    Approve
                  </button>
                  <button
                    className="secondary-button"
                    disabled={busyAccountId === account.id}
                    type="button"
                    onClick={() =>
                      void runAction(
                        account.id,
                        () => rejectClaim(account.id),
                        `${account.name}'s profile request was rejected.`,
                      )
                    }
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      <div className="account-section">
        <h3>All player accounts</h3>
        {accounts.length === 0 ? (
          <p className="status-panel">No player accounts have been created.</p>
        ) : (
          <div className="account-list">
            {accounts.map((account) => {
              const availablePlayers = (snapshot?.players ?? []).filter(
                (player) =>
                  (!player.user || player.user.id === account.id) &&
                  (!player.requestedBy || player.requestedBy.id === account.id),
              );
              return (
                <article className="account-card" key={account.id}>
                  <div>
                    <strong>{account.name}</strong>
                    <span>{account.email}</span>
                    <span>
                      {account.player
                        ? `Linked to ${account.player.name}`
                        : account.requestedPlayer
                          ? `Awaiting approval for ${account.requestedPlayer.name}`
                          : 'No Player profile linked'}
                    </span>
                  </div>
                  <label>
                    Assigned Player profile
                    <select
                      disabled={busyAccountId === account.id}
                      value={account.player?.id ?? ''}
                      onChange={(event) => {
                        const playerId = event.target.value;
                        void runAction(
                          account.id,
                          () => assignPlayer(account.id, playerId || null),
                          playerId
                            ? `${account.name}'s Player profile was updated.`
                            : `${account.name}'s Player profile was unassigned.`,
                        );
                      }}
                    >
                      <option value="">Unassigned</option>
                      {availablePlayers.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.name}
                          {player.isActiveSquad ? '' : ' · inactive'}
                        </option>
                      ))}
                    </select>
                  </label>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {success && <p className="form-success">{success}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export function AdminAccountsPage() {
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
      <AccountsManager />
    </>
  );
}
