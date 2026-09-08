import type { AccountsSnapshot, PlayerAccount } from './types';

type ErrorResponse = { error?: { code?: string; message?: string } };

export class AccountApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AccountApiError';
  }
}

async function accountRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response
      .json()
      .catch(() => null)) as ErrorResponse | null;
    throw new AccountApiError(
      body?.error?.message ?? 'The account request could not be completed.',
      response.status,
      body?.error?.code,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function getAdminAccounts(): Promise<AccountsSnapshot> {
  return accountRequest('/api/admin/accounts');
}

export async function approveClaim(userId: string): Promise<PlayerAccount> {
  const response = await accountRequest<{ account: PlayerAccount }>(
    `/api/admin/accounts/${encodeURIComponent(userId)}/approve`,
    { method: 'POST' },
  );
  return response.account;
}

export function rejectClaim(userId: string): Promise<void> {
  return accountRequest(
    `/api/admin/accounts/${encodeURIComponent(userId)}/reject`,
    { method: 'POST' },
  );
}

export async function assignPlayer(
  userId: string,
  playerId: string | null,
): Promise<PlayerAccount> {
  const response = await accountRequest<{ account: PlayerAccount }>(
    `/api/admin/accounts/${encodeURIComponent(userId)}/player`,
    { body: JSON.stringify({ playerId }), method: 'PUT' },
  );
  return response.account;
}
