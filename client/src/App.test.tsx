import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import type { FixtureSummary } from './fixtures/types';

function mockResponse(body: unknown, status: number): Response {
  return {
    json: async () => body,
    ok: status >= 200 && status < 300,
    status,
  } as Response;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

describe('App', () => {
  it('renders the public website for an anonymous visitor', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse(
          {
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authentication is required.',
            },
          },
          401,
        ),
      ),
    );

    render(<App />);

    expect(
      screen.getByRole('heading', { name: '24 Hour Party People' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Football, friends, and the full story.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Players' })).toBeInTheDocument();
  });

  it('shows the sign-in screen on the admin route for an anonymous visitor', async () => {
    window.history.replaceState({}, '', '/admin');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse(
          {
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authentication is required.',
            },
          },
          401,
        ),
      ),
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeInTheDocument();
  });

  it('shows the signed-in administrator in the website navigation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse(
          {
            user: {
              id: 'f035c5b7-243a-4e3d-931d-83cd57ad615a',
              name: 'Jack',
              email: 'jack@example.test',
              role: 'ADMIN',
            },
          },
          200,
        ),
      ),
    );

    render(<App />);

    expect(
      await screen.findByRole('button', { name: 'Sign out Jack' }),
    ).toBeInTheDocument();
  });

  it('renders active players returned by the public API', async () => {
    window.history.replaceState({}, '', '/players');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        if (String(input) === '/api/auth/me') {
          return Promise.resolve(
            mockResponse(
              {
                error: {
                  code: 'AUTHENTICATION_REQUIRED',
                  message: 'Authentication is required.',
                },
              },
              401,
            ),
          );
        }

        return Promise.resolve(
          mockResponse(
            {
              players: [
                {
                  createdAt: '2026-09-02T12:00:00.000Z',
                  description: 'A dependable defender.',
                  id: '12c37c8a-6559-493b-9615-76ddab94dd66',
                  isActiveSquad: true,
                  name: 'Alex Example',
                  position: 'DEF',
                  profilePictureUrl: null,
                },
              ],
            },
            200,
          ),
        );
      }),
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Alex Example' }),
    ).toBeInTheDocument();
    expect(screen.getByText('A dependable defender.')).toBeInTheDocument();
  });

  it('renders current and historic statistics on a player profile', async () => {
    const playerId = '12c37c8a-6559-493b-9615-76ddab94dd66';
    window.history.replaceState({}, '', `/players/${playerId}`);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        if (String(input) === '/api/auth/me') {
          return Promise.resolve(
            mockResponse(
              {
                error: {
                  code: 'AUTHENTICATION_REQUIRED',
                  message: 'Authentication is required.',
                },
              },
              401,
            ),
          );
        }

        return Promise.resolve(
          mockResponse(
            {
              player: {
                createdAt: '2026-09-02T12:00:00.000Z',
                description: 'A dependable defender.',
                id: playerId,
                isActiveSquad: true,
                name: 'Alex Example',
                position: 'DEF',
                profilePictureUrl: null,
                seasonStats: [
                  {
                    assists: 2,
                    cleanSheets: 1,
                    gamesPlayed: 8,
                    goals: 3,
                    id: 'current-stat',
                    note: null,
                    season: {
                      endDate: '2026-09-01',
                      id: 'current-season',
                      isCurrent: true,
                      name: 'Summer 2026',
                      startDate: '2026-06-01',
                    },
                  },
                  {
                    assists: 1,
                    cleanSheets: 2,
                    gamesPlayed: null,
                    goals: 4,
                    id: 'historic-stat',
                    note: 'Games played was not tracked.',
                    season: {
                      endDate: '2026-05-31',
                      id: 'historic-season',
                      isCurrent: false,
                      name: 'Spring 2026',
                      startDate: '2026-03-01',
                    },
                  },
                ],
              },
            },
            200,
          ),
        );
      }),
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Alex Example' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Summer 2026' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Spring 2026' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Not recorded')).toBeInTheDocument();
    expect(
      screen.getByText('Games played was not tracked.'),
    ).toBeInTheDocument();
  });

  it('renders player management for an authenticated administrator', async () => {
    window.history.replaceState({}, '', '/admin');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        if (String(input) === '/api/auth/me') {
          return Promise.resolve(
            mockResponse(
              {
                user: {
                  email: 'jack@example.test',
                  id: 'f035c5b7-243a-4e3d-931d-83cd57ad615a',
                  name: 'Jack',
                  role: 'ADMIN',
                },
              },
              200,
            ),
          );
        }

        return Promise.resolve(mockResponse({ players: [] }, 200));
      }),
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Manage players' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Add a player' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('No player profiles have been created.'),
    ).toBeInTheDocument();
  });

  it('manages seasons and preserves untracked historic games on the administrator statistics route', async () => {
    const playerId = '12c37c8a-6559-493b-9615-76ddab94dd66';
    window.history.replaceState({}, '', '/admin/statistics');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const path = String(input);
        if (path === '/api/auth/me') {
          return Promise.resolve(
            mockResponse(
              {
                user: {
                  email: 'jack@example.test',
                  id: 'f035c5b7-243a-4e3d-931d-83cd57ad615a',
                  name: 'Jack',
                  role: 'ADMIN',
                },
              },
              200,
            ),
          );
        }

        if (path === '/api/admin/seasons') {
          return Promise.resolve(
            mockResponse(
              {
                seasons: [
                  {
                    endDate: '2026-08-31T00:00:00.000Z',
                    id: 'current-season',
                    isCurrent: true,
                    name: 'Summer 2026',
                    startDate: '2026-06-01T00:00:00.000Z',
                    tracksGamesPlayed: true,
                  },
                  {
                    endDate: '2026-05-31T00:00:00.000Z',
                    id: 'historic-season',
                    isCurrent: false,
                    name: 'Spring 2026',
                    startDate: '2026-03-01T00:00:00.000Z',
                    tracksGamesPlayed: false,
                  },
                ],
              },
              200,
            ),
          );
        }

        if (path === '/api/admin/players') {
          return Promise.resolve(
            mockResponse(
              {
                players: [
                  {
                    createdAt: '2026-09-02T12:00:00.000Z',
                    description: 'A dependable defender.',
                    id: playerId,
                    isActiveSquad: true,
                    name: 'Alex Example',
                    position: 'DEF',
                    profilePictureUrl: null,
                  },
                ],
              },
              200,
            ),
          );
        }

        if (path === `/api/admin/players/${playerId}/season-stats`) {
          return Promise.resolve(
            mockResponse(
              {
                seasonStats: [
                  {
                    assists: 2,
                    cleanSheets: 1,
                    gamesPlayed: null,
                    goals: 3,
                    id: 'historic-stat',
                    note: null,
                    seasonId: 'historic-season',
                  },
                ],
              },
              200,
            ),
          );
        }

        return Promise.resolve(mockResponse({}, 404));
      }),
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Manage seasons' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Manage statistics' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Seasons & statistics' }),
    ).toHaveClass('active');

    await screen.findByRole('option', { name: 'Summer 2026 (current)' });

    fireEvent.change(screen.getByRole('combobox', { name: 'Season' }), {
      target: { value: 'historic-season' },
    });

    expect(await screen.findByText('Not recorded')).toBeInTheDocument();
    expect(
      screen.getByRole('spinbutton', { name: /Games played/ }),
    ).toBeDisabled();
    expect(screen.getByLabelText('Goals')).toHaveValue(3);
  });

  it('renders separate same-date league and cup results in game history', async () => {
    window.history.replaceState({}, '', '/games');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        if (String(input) === '/api/auth/me') {
          return Promise.resolve(
            mockResponse(
              {
                error: {
                  code: 'AUTHENTICATION_REQUIRED',
                  message: 'Authentication is required.',
                },
              },
              401,
            ),
          );
        }

        return Promise.resolve(
          mockResponse(
            {
              games: [
                {
                  competition: 'LEAGUE',
                  createdAt: '2026-07-28T20:00:00.000Z',
                  datePlayed: '2026-07-28T00:00:00.000Z',
                  fixtureId: null,
                  id: 'league-result',
                  isWalkover: true,
                  opponentClub: { id: 'opponent', name: 'Norton Rivals' },
                  opponentScore: null,
                  ourScore: null,
                  season: { id: 'season', name: 'Summer 2026' },
                  walkoverReason: 'Opponent could not field a team.',
                },
                {
                  competition: 'CUP',
                  createdAt: '2026-07-28T20:30:00.000Z',
                  datePlayed: '2026-07-28T00:00:00.000Z',
                  fixtureId: null,
                  id: 'cup-result',
                  isWalkover: false,
                  opponentClub: { id: 'opponent', name: 'Norton Rivals' },
                  opponentScore: 2,
                  ourScore: 5,
                  season: { id: 'season', name: 'Summer 2026' },
                  walkoverReason: null,
                },
              ],
            },
            200,
          ),
        );
      }),
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Game history' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { name: 'Norton Rivals' }),
    ).toHaveLength(2);
    expect(screen.getByText('Walkover')).toBeInTheDocument();
    expect(screen.getByText('5–2')).toBeInTheDocument();
    expect(
      screen.getByText('Opponent could not field a team.'),
    ).toBeInTheDocument();
  });

  it('renders the current league table and highlights 24 Hour Party People', async () => {
    window.history.replaceState({}, '', '/standings');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        if (String(input) === '/api/auth/me') {
          return Promise.resolve(
            mockResponse(
              {
                error: {
                  code: 'AUTHENTICATION_REQUIRED',
                  message: 'Authentication is required.',
                },
              },
              401,
            ),
          );
        }

        return Promise.resolve(
          mockResponse(
            {
              lastUpdated: '2026-09-07T12:30:00.000Z',
              season: { id: 'season', name: 'Summer 2026' },
              standings: [
                {
                  clubName: 'League Leaders',
                  drawn: 1,
                  ga: 5,
                  gd: 7,
                  gf: 12,
                  id: 'leaders',
                  lost: 0,
                  played: 4,
                  points: 10,
                  position: 1,
                  scrapedAt: '2026-09-07T12:30:00.000Z',
                  walkoverGames: 0,
                  won: 3,
                },
                {
                  clubName: '24 Hour Party People',
                  drawn: 0,
                  ga: 8,
                  gd: 2,
                  gf: 10,
                  id: 'party-people',
                  lost: 1,
                  played: 4,
                  points: 9,
                  position: 2,
                  scrapedAt: '2026-09-07T12:30:00.000Z',
                  walkoverGames: 1,
                  won: 3,
                },
              ],
            },
            200,
          ),
        );
      }),
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Current standings' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Summer 2026' }),
    ).toBeInTheDocument();
    const teamCell = screen.getByRole('rowheader', {
      name: '24 Hour Party People',
    });
    expect(teamCell.closest('tr')).toHaveClass('team-standing-row');
    expect(screen.getByText(/Last updated/)).toBeInTheDocument();
  });

  it('replaces the complete standings snapshot as an administrator', async () => {
    let submittedRows: unknown;
    window.history.replaceState({}, '', '/admin/standings');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
          const path = String(input);
          if (path === '/api/auth/me') {
            return Promise.resolve(
              mockResponse(
                {
                  user: {
                    email: 'jack@example.test',
                    id: 'f035c5b7-243a-4e3d-931d-83cd57ad615a',
                    name: 'Jack',
                    role: 'ADMIN',
                  },
                },
                200,
              ),
            );
          }

          if (path === '/api/admin/standings' && !init?.method) {
            return Promise.resolve(
              mockResponse(
                {
                  lastUpdated: null,
                  season: { id: 'season', name: 'Summer 2026' },
                  standings: [],
                },
                200,
              ),
            );
          }

          if (
            path === '/api/admin/standings/current' &&
            init?.method === 'PUT'
          ) {
            submittedRows = (JSON.parse(String(init.body)) as { rows: unknown })
              .rows;
            return Promise.resolve(
              mockResponse(
                {
                  lastUpdated: '2026-09-07T13:00:00.000Z',
                  season: { id: 'season', name: 'Summer 2026' },
                  standings: [
                    {
                      clubName: '24 Hour Party People',
                      drawn: 0,
                      ga: 0,
                      gd: 2,
                      gf: 2,
                      id: 'party-people',
                      lost: 0,
                      played: 1,
                      points: 3,
                      position: 1,
                      scrapedAt: '2026-09-07T13:00:00.000Z',
                      walkoverGames: 0,
                      won: 1,
                    },
                    {
                      clubName: 'New Rivals',
                      drawn: 0,
                      ga: 2,
                      gd: -2,
                      gf: 0,
                      id: 'new-rivals',
                      lost: 1,
                      played: 1,
                      points: 0,
                      position: 2,
                      scrapedAt: '2026-09-07T13:00:00.000Z',
                      walkoverGames: 0,
                      won: 0,
                    },
                  ],
                },
                200,
              ),
            );
          }

          return Promise.resolve(mockResponse({}, 404));
        }),
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Manage standings' }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('24 Hour Party People played'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('24 Hour Party People won'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('24 Hour Party People gf'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('24 Hour Party People points'), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add club' }));
    fireEvent.change(screen.getByLabelText('Row 2 club name'), {
      target: { value: 'New Rivals' },
    });
    fireEvent.change(screen.getByLabelText('New Rivals played'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('New Rivals lost'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('New Rivals ga'), {
      target: { value: '2' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save complete table' }),
    );

    expect(
      await screen.findByText('Current standings updated successfully.'),
    ).toBeInTheDocument();
    expect(submittedRows).toEqual([
      {
        clubName: '24 Hour Party People',
        drawn: 0,
        ga: 0,
        gf: 2,
        lost: 0,
        played: 1,
        points: 3,
        position: 1,
        walkoverGames: 0,
        won: 1,
      },
      {
        clubName: 'New Rivals',
        drawn: 0,
        ga: 2,
        gf: 0,
        lost: 1,
        played: 1,
        points: 0,
        position: 2,
        walkoverGames: 0,
        won: 0,
      },
    ]);
  });

  it('renders upcoming fixtures with Sheffield-local kick-off times', async () => {
    window.history.replaceState({}, '', '/fixtures');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        if (String(input) === '/api/auth/me') {
          return Promise.resolve(
            mockResponse(
              {
                error: {
                  code: 'AUTHENTICATION_REQUIRED',
                  message: 'Authentication is required.',
                },
              },
              401,
            ),
          );
        }

        return Promise.resolve(
          mockResponse(
            {
              fixtures: [
                {
                  competition: 'LEAGUE',
                  id: 'fixture',
                  opponentClub: { id: 'opponent', name: 'Norton Rivals' },
                  result: null,
                  scheduledDate: '2026-09-15T00:00:00.000Z',
                  scheduledTime: '1970-01-01T20:15:00.000Z',
                  season: { id: 'season', name: 'Summer 2026' },
                  source: 'MANUAL',
                  status: 'SCHEDULED',
                  venue: 'Norton Playing Fields 3G',
                },
              ],
            },
            200,
          ),
        );
      }),
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Upcoming fixtures' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Norton Rivals' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Tuesday, 15 September 2026')).toBeInTheDocument();
    expect(screen.getByText('20:15')).toBeInTheDocument();
    expect(screen.getByText('Norton Playing Fields 3G')).toBeInTheDocument();
  });

  it('creates fixtures while keeping recorded fixtures read-only for administrators', async () => {
    const seasonId = '12c37c8a-6559-493b-9615-76ddab94dd66';
    let submittedBody: Record<string, unknown> | undefined;
    let fixtures: FixtureSummary[] = [
      {
        competition: 'LEAGUE',
        id: 'played-fixture',
        opponentClub: { id: 'opponent', name: 'Played Opponent' },
        result: { id: 'result' },
        scheduledDate: '2026-09-01T00:00:00.000Z',
        scheduledTime: '1970-01-01T19:30:00.000Z',
        season: { id: seasonId, name: 'Summer 2026' },
        source: 'MANUAL',
        status: 'PLAYED',
        venue: null,
      },
    ];
    window.history.replaceState({}, '', '/admin/fixtures');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
          const path = String(input);
          if (path === '/api/auth/me') {
            return Promise.resolve(
              mockResponse(
                {
                  user: {
                    email: 'jack@example.test',
                    id: 'f035c5b7-243a-4e3d-931d-83cd57ad615a',
                    name: 'Jack',
                    role: 'ADMIN',
                  },
                },
                200,
              ),
            );
          }

          if (path === '/api/admin/seasons') {
            return Promise.resolve(
              mockResponse(
                {
                  seasons: [
                    {
                      endDate: '2026-12-31T00:00:00.000Z',
                      id: seasonId,
                      isCurrent: true,
                      name: 'Summer 2026',
                      startDate: '2026-01-01T00:00:00.000Z',
                      tracksGamesPlayed: true,
                    },
                  ],
                },
                200,
              ),
            );
          }

          if (path === '/api/admin/fixtures' && init?.method === 'POST') {
            submittedBody = JSON.parse(String(init.body)) as Record<
              string,
              unknown
            >;
            const createdFixture: FixtureSummary = {
              competition: 'CUP',
              id: 'created-fixture',
              opponentClub: { id: 'new-opponent', name: 'New Opponent' },
              result: null,
              scheduledDate: '2026-09-22T00:00:00.000Z',
              scheduledTime: null,
              season: { id: seasonId, name: 'Summer 2026' },
              source: 'MANUAL',
              status: 'SCHEDULED',
              venue: 'Pitch 2',
            };
            fixtures = [createdFixture, ...fixtures];
            return Promise.resolve(
              mockResponse({ fixture: createdFixture }, 201),
            );
          }

          if (path === '/api/admin/fixtures') {
            return Promise.resolve(mockResponse({ fixtures }, 200));
          }

          return Promise.resolve(mockResponse({}, 404));
        }),
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Manage fixtures' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Recorded')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit' }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Opponent'), {
      target: { value: 'New Opponent' },
    });
    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2026-09-22' },
    });
    fireEvent.change(screen.getByLabelText('Competition'), {
      target: { value: 'CUP' },
    });
    fireEvent.change(screen.getByLabelText('Venue (optional)'), {
      target: { value: 'Pitch 2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create fixture' }));

    expect(
      await screen.findByText('Fixture created successfully.'),
    ).toBeInTheDocument();
    expect(submittedBody).toEqual({
      competition: 'CUP',
      opponentName: 'New Opponent',
      scheduledDate: '2026-09-22',
      scheduledTime: null,
      seasonId,
      venue: 'Pitch 2',
    });
    expect(
      screen.getByRole('heading', { name: 'New Opponent' }),
    ).toBeInTheDocument();
  });

  it('prefills a manual cup result after an administrator saves a league walkover', async () => {
    const seasonId = '12c37c8a-6559-493b-9615-76ddab94dd66';
    let submittedBody: unknown;
    window.history.replaceState({}, '', '/admin/games');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
          const path = String(input);
          if (path === '/api/auth/me') {
            return Promise.resolve(
              mockResponse(
                {
                  user: {
                    email: 'jack@example.test',
                    id: 'f035c5b7-243a-4e3d-931d-83cd57ad615a',
                    name: 'Jack',
                    role: 'ADMIN',
                  },
                },
                200,
              ),
            );
          }

          if (path === '/api/admin/games/fixtures') {
            return Promise.resolve(mockResponse({ fixtures: [] }, 200));
          }

          if (path === '/api/admin/seasons') {
            return Promise.resolve(
              mockResponse(
                {
                  seasons: [
                    {
                      endDate: '2026-08-31T00:00:00.000Z',
                      id: seasonId,
                      isCurrent: true,
                      name: 'Summer 2026',
                      startDate: '2026-06-01T00:00:00.000Z',
                      tracksGamesPlayed: true,
                    },
                  ],
                },
                200,
              ),
            );
          }

          if (path === '/api/admin/games' && init?.method === 'POST') {
            submittedBody = JSON.parse(String(init.body));
            return Promise.resolve(
              mockResponse(
                {
                  game: {
                    competition: 'LEAGUE',
                    createdAt: '2026-07-28T20:00:00.000Z',
                    datePlayed: '2026-07-28T00:00:00.000Z',
                    fixtureId: null,
                    id: 'league-walkover',
                    isWalkover: true,
                    opponentClub: {
                      id: 'opponent',
                      name: 'Norton Rivals',
                    },
                    opponentScore: null,
                    ourScore: null,
                    season: { id: seasonId, name: 'Summer 2026' },
                    walkoverReason: 'No opposition players.',
                  },
                  standingsRefreshRequired: false,
                },
                201,
              ),
            );
          }

          return Promise.resolve(mockResponse({}, 404));
        }),
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Record a result' }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Opponent'), {
      target: { value: 'Norton Rivals' },
    });
    fireEvent.change(screen.getByLabelText('Date played'), {
      target: { value: '2026-07-28' },
    });
    fireEvent.click(screen.getByLabelText('This league game was a walkover'));
    fireEvent.change(screen.getByRole('textbox', { name: /Walkover reason/ }), {
      target: { value: 'No opposition players.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save result' }));

    expect(
      await screen.findByText(
        'League walkover saved. Add the cup result played instead.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Competition')).toHaveValue('CUP');
    expect(screen.getByLabelText('Opponent')).toHaveValue('Norton Rivals');
    expect(screen.getByLabelText('Date played')).toHaveValue('2026-07-28');
    expect(submittedBody).toMatchObject({
      competition: 'LEAGUE',
      datePlayed: '2026-07-28',
      entryMode: 'manual',
      isWalkover: true,
      opponentName: 'Norton Rivals',
      opponentScore: null,
      ourScore: null,
      seasonId,
    });
  });
});

describe('club history', () => {
  it('renders finalized season finishes on the public route', async () => {
    window.history.replaceState({}, '', '/club-history');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        if (String(input) === '/api/auth/me') {
          return Promise.resolve(mockResponse({}, 401));
        }

        return Promise.resolve(
          mockResponse(
            {
              history: [
                {
                  clubName: '24 Hour Party People',
                  drawn: 2,
                  finalizedAt: '2026-09-01T10:00:00.000Z',
                  ga: 18,
                  gd: 6,
                  gf: 24,
                  id: 'history-entry',
                  lost: 3,
                  played: 12,
                  points: 23,
                  position: 2,
                  season: {
                    endDate: '2026-08-31T00:00:00.000Z',
                    id: 'season',
                    name: 'Summer 2026',
                    startDate: '2026-06-01T00:00:00.000Z',
                  },
                  walkoverGames: 1,
                  won: 7,
                },
              ],
            },
            200,
          ),
        );
      }),
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Club history' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('rowheader', { name: 'Summer 2026' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('cell', { name: '24 Hour Party People' }),
    ).toBeInTheDocument();
  });

  it('finalizes an eligible season from the administrator route', async () => {
    const seasonId = '12c37c8a-6559-493b-9615-76ddab94dd66';
    let finalized = false;
    window.history.replaceState({}, '', '/admin/club-history');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
          const path = String(input);
          if (path === '/api/auth/me') {
            return Promise.resolve(
              mockResponse(
                {
                  user: {
                    email: 'jack@example.test',
                    id: 'f035c5b7-243a-4e3d-931d-83cd57ad615a',
                    name: 'Jack',
                    role: 'ADMIN',
                  },
                },
                200,
              ),
            );
          }

          if (path === '/api/admin/club-history' && !init?.method) {
            return Promise.resolve(
              mockResponse(
                {
                  candidates: [
                    {
                      endDate: '2026-08-31T00:00:00.000Z',
                      id: seasonId,
                      name: 'Summer 2026',
                      standing: {
                        drawn: 2,
                        ga: 18,
                        gd: 6,
                        gf: 24,
                        lost: 3,
                        played: 12,
                        points: 23,
                        position: 2,
                        walkoverGames: 1,
                        won: 7,
                      },
                      startDate: '2026-06-01T00:00:00.000Z',
                    },
                  ],
                  history: [],
                },
                200,
              ),
            );
          }

          if (
            path === `/api/admin/club-history/${seasonId}/finalize` &&
            init?.method === 'POST'
          ) {
            finalized = true;
            return Promise.resolve(
              mockResponse(
                {
                  history: {
                    clubName: '24 Hour Party People',
                    drawn: 2,
                    finalizedAt: '2026-09-01T10:00:00.000Z',
                    ga: 18,
                    gd: 6,
                    gf: 24,
                    id: 'history-entry',
                    lost: 3,
                    played: 12,
                    points: 23,
                    position: 2,
                    season: {
                      endDate: '2026-08-31T00:00:00.000Z',
                      id: seasonId,
                      name: 'Summer 2026',
                      startDate: '2026-06-01T00:00:00.000Z',
                    },
                    walkoverGames: 1,
                    won: 7,
                  },
                },
                201,
              ),
            );
          }

          return Promise.resolve(mockResponse({}, 404));
        }),
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Finalize club history' }),
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Finalize' }));

    expect(
      await screen.findByText('Summer 2026 was added to club history.'),
    ).toBeInTheDocument();
    expect(finalized).toBe(true);
    expect(
      screen.getByText('No ended seasons are waiting to be finalized.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('rowheader', { name: 'Summer 2026' }),
    ).toBeInTheDocument();
  });
});
