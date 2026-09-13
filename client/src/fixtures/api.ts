import type {
  AdminFixtureAvailability,
  AvailabilityResponse,
  FixtureInput,
  FixturesSnapshot,
  FixtureSummary,
  OwnFixtureAvailability,
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

async function fixtureRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const apiError = isErrorResponse(body) ? body.error : undefined;
    throw new Error(
      apiError?.message ?? 'The fixture request could not be completed.',
    );
  }

  return (await response.json()) as T;
}

export function getUpcomingFixtures(): Promise<FixturesSnapshot> {
  return fixtureRequest<FixturesSnapshot>('/api/fixtures/upcoming');
}

export async function getOwnFixtureAvailability(): Promise<
  OwnFixtureAvailability[]
> {
  const response = await fixtureRequest<{
    availability: OwnFixtureAvailability[];
  }>('/api/fixtures/availability');
  return response.availability;
}

export async function setFixtureAvailability(
  fixtureId: string,
  availabilityResponse: AvailabilityResponse,
): Promise<OwnFixtureAvailability> {
  const response = await fixtureRequest<{
    availability: OwnFixtureAvailability;
  }>(`/api/fixtures/${encodeURIComponent(fixtureId)}/availability`, {
    body: JSON.stringify({ response: availabilityResponse }),
    headers: { 'Content-Type': 'application/json' },
    method: 'PUT',
  });
  return response.availability;
}

export async function getAdminFixtureAvailability(): Promise<
  AdminFixtureAvailability[]
> {
  const response = await fixtureRequest<{
    fixtures: AdminFixtureAvailability[];
  }>('/api/admin/fixtures/availability');
  return response.fixtures;
}

export async function getAdminFixtures(): Promise<FixtureSummary[]> {
  const response = await fixtureRequest<{ fixtures: FixtureSummary[] }>(
    '/api/admin/fixtures',
  );
  return response.fixtures;
}

export async function createFixture(
  input: FixtureInput,
): Promise<FixtureSummary> {
  const response = await fixtureRequest<{ fixture: FixtureSummary }>(
    '/api/admin/fixtures',
    {
      body: JSON.stringify(input),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );
  return response.fixture;
}

export async function updateFixture(
  fixtureId: string,
  input: FixtureInput,
): Promise<FixtureSummary> {
  const response = await fixtureRequest<{ fixture: FixtureSummary }>(
    `/api/admin/fixtures/${encodeURIComponent(fixtureId)}`,
    {
      body: JSON.stringify(input),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    },
  );
  return response.fixture;
}
