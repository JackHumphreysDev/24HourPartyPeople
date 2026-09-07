import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App';

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
