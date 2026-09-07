import type {
  AdminSeasonStat,
  PlayerDetail,
  PlayerInput,
  PlayerSummary,
  SeasonInput,
  SeasonStatInput,
  SeasonSummary,
} from './types';

type ErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class PlayerApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'PlayerApiError';
  }
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  return typeof value === 'object' && value !== null && 'error' in value;
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function playerRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
  });

  if (!response.ok) {
    const body: unknown = await readJson<unknown>(response).catch(() => null);
    const apiError = isErrorResponse(body) ? body.error : undefined;
    throw new PlayerApiError(
      apiError?.message ?? 'The request could not be completed.',
      response.status,
      apiError?.code,
    );
  }

  return readJson<T>(response);
}

function toFormData(input: PlayerInput): FormData {
  const formData = new FormData();
  formData.set('description', input.description);
  formData.set('isActiveSquad', String(input.isActiveSquad));
  formData.set('name', input.name);
  formData.set('position', input.position);
  formData.set('removeProfilePicture', String(input.removeProfilePicture));

  if (input.image) {
    formData.set('profilePicture', input.image);
  }

  return formData;
}

export async function getPlayers(): Promise<PlayerSummary[]> {
  const response = await playerRequest<{ players: PlayerSummary[] }>(
    '/api/players',
  );
  return response.players;
}

export async function getPlayer(playerId: string): Promise<PlayerDetail> {
  const response = await playerRequest<{ player: PlayerDetail }>(
    `/api/players/${encodeURIComponent(playerId)}`,
  );
  return response.player;
}

export async function getAdminPlayers(): Promise<PlayerSummary[]> {
  const response = await playerRequest<{ players: PlayerSummary[] }>(
    '/api/admin/players',
  );
  return response.players;
}

export async function createPlayer(input: PlayerInput): Promise<PlayerSummary> {
  const response = await playerRequest<{ player: PlayerSummary }>(
    '/api/admin/players',
    {
      body: toFormData(input),
      method: 'POST',
    },
  );
  return response.player;
}

export async function updatePlayer(
  playerId: string,
  input: PlayerInput,
): Promise<PlayerSummary> {
  const response = await playerRequest<{ player: PlayerSummary }>(
    `/api/admin/players/${encodeURIComponent(playerId)}`,
    {
      body: toFormData(input),
      method: 'PUT',
    },
  );
  return response.player;
}

export async function getAdminSeasons(): Promise<SeasonSummary[]> {
  const response = await playerRequest<{ seasons: SeasonSummary[] }>(
    '/api/admin/seasons',
  );
  return response.seasons;
}

export async function createSeason(input: SeasonInput): Promise<SeasonSummary> {
  const response = await playerRequest<{ season: SeasonSummary }>(
    '/api/admin/seasons',
    {
      body: JSON.stringify(input),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );
  return response.season;
}

export async function updateSeason(
  seasonId: string,
  input: SeasonInput,
): Promise<SeasonSummary> {
  const response = await playerRequest<{ season: SeasonSummary }>(
    `/api/admin/seasons/${encodeURIComponent(seasonId)}`,
    {
      body: JSON.stringify(input),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    },
  );
  return response.season;
}

export async function getPlayerSeasonStats(
  playerId: string,
): Promise<AdminSeasonStat[]> {
  const response = await playerRequest<{ seasonStats: AdminSeasonStat[] }>(
    `/api/admin/players/${encodeURIComponent(playerId)}/season-stats`,
  );
  return response.seasonStats;
}

export async function savePlayerSeasonStats(
  playerId: string,
  input: SeasonStatInput,
): Promise<AdminSeasonStat> {
  const response = await playerRequest<{ seasonStats: AdminSeasonStat }>(
    `/api/admin/players/${encodeURIComponent(playerId)}/season-stats`,
    {
      body: JSON.stringify(input),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );
  return response.seasonStats;
}
