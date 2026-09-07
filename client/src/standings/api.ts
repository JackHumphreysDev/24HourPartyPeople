import type { StandingRowInput, StandingsSnapshot } from './types';

type ErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

function isErrorResponse(value: unknown): value is ErrorResponse {
  return typeof value === 'object' && value !== null && 'error' in value;
}

async function standingsRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const apiError = isErrorResponse(body) ? body.error : undefined;
    throw new Error(
      apiError?.message ?? 'The standings request could not be completed.',
    );
  }

  return (await response.json()) as T;
}

export function getCurrentStandings(): Promise<StandingsSnapshot> {
  return standingsRequest<StandingsSnapshot>('/api/standings/current');
}

export function getAdminStandings(): Promise<StandingsSnapshot> {
  return standingsRequest<StandingsSnapshot>('/api/admin/standings');
}

export function replaceCurrentStandings(
  rows: StandingRowInput[],
): Promise<StandingsSnapshot> {
  return standingsRequest<StandingsSnapshot>('/api/admin/standings/current', {
    body: JSON.stringify({ rows }),
    headers: { 'Content-Type': 'application/json' },
    method: 'PUT',
  });
}
