import type {
  AdminClubHistory,
  ClubHistoryEntry,
  SeasonSquadEntry,
  SeasonSquadInput,
} from './types';

type ErrorResponse = {
  error?: {
    message?: string;
  };
};

function isErrorResponse(value: unknown): value is ErrorResponse {
  return typeof value === 'object' && value !== null && 'error' in value;
}

async function historyRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const apiError = isErrorResponse(body) ? body.error : undefined;
    throw new Error(
      apiError?.message ?? 'The club history request could not be completed.',
    );
  }

  return (await response.json()) as T;
}

export async function getClubHistory(): Promise<ClubHistoryEntry[]> {
  const response = await historyRequest<{ history: ClubHistoryEntry[] }>(
    '/api/club-history',
  );
  return response.history;
}

export function getAdminClubHistory(): Promise<AdminClubHistory> {
  return historyRequest<AdminClubHistory>('/api/admin/club-history');
}

export async function finaliseClubHistory(
  seasonId: string,
): Promise<ClubHistoryEntry> {
  const response = await historyRequest<{ history: ClubHistoryEntry }>(
    `/api/admin/club-history/${encodeURIComponent(seasonId)}/finalise`,
    { method: 'POST' },
  );
  return response.history;
}

export async function saveSeasonSquad(
  seasonId: string,
  entries: SeasonSquadInput,
): Promise<SeasonSquadEntry[]> {
  const response = await historyRequest<{ entries: SeasonSquadEntry[] }>(
    `/api/admin/club-history/${encodeURIComponent(seasonId)}/squad`,
    {
      body: JSON.stringify({ entries }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    },
  );
  return response.entries;
}
