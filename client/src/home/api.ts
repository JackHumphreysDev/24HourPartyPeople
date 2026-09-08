import type { TeamProfile } from './types';

type ErrorResponse = {
  error?: {
    message?: string;
  };
};

function isErrorResponse(value: unknown): value is ErrorResponse {
  return typeof value === 'object' && value !== null && 'error' in value;
}

async function teamProfileRequest<T>(
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
      apiError?.message ?? 'The team profile request could not be completed.',
    );
  }

  return (await response.json()) as T;
}

export async function getTeamProfile(): Promise<TeamProfile> {
  const response = await teamProfileRequest<{ teamProfile: TeamProfile }>(
    '/api/team-profile',
  );
  return response.teamProfile;
}

export async function getAdminTeamProfile(): Promise<TeamProfile> {
  const response = await teamProfileRequest<{ teamProfile: TeamProfile }>(
    '/api/admin/team-profile',
  );
  return response.teamProfile;
}

export async function updateTeamProfile(
  description: string,
): Promise<TeamProfile> {
  const response = await teamProfileRequest<{ teamProfile: TeamProfile }>(
    '/api/admin/team-profile',
    {
      body: JSON.stringify({ description }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    },
  );
  return response.teamProfile;
}
