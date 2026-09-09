import type {
  AdminFixture,
  CreatedGameResult,
  GameResultInput,
  GameSummary,
  GamePlayerContribution,
  PlayerStatsSnapshot,
} from './types';

type ErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

function isErrorResponse(value: unknown): value is ErrorResponse {
  return typeof value === 'object' && value !== null && 'error' in value;
}

async function gameRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const apiError = isErrorResponse(body) ? body.error : undefined;
    throw new Error(
      apiError?.message ?? 'The game request could not be completed.',
    );
  }

  return (await response.json()) as T;
}

export async function getGames(): Promise<GameSummary[]> {
  const response = await gameRequest<{ games: GameSummary[] }>('/api/games');
  return response.games;
}

export async function getAdminFixtures(): Promise<AdminFixture[]> {
  const response = await gameRequest<{ fixtures: AdminFixture[] }>(
    '/api/admin/games/fixtures',
  );
  return response.fixtures;
}

export function createGame(input: GameResultInput): Promise<CreatedGameResult> {
  return gameRequest<CreatedGameResult>('/api/admin/games', {
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

export async function getPlayerStatsSnapshot(): Promise<PlayerStatsSnapshot> {
  return gameRequest<PlayerStatsSnapshot>('/api/admin/games/player-stats');
}

export async function saveGamePlayerStats(
  gameId: string,
  playerStats: GamePlayerContribution[],
): Promise<GamePlayerContribution[]> {
  const response = await gameRequest<{
    playerStats: GamePlayerContribution[];
  }>(`/api/admin/games/${encodeURIComponent(gameId)}/player-stats`, {
    body: JSON.stringify({ playerStats }),
    headers: { 'Content-Type': 'application/json' },
    method: 'PUT',
  });
  return response.playerStats;
}
