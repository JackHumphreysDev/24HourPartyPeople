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

  it('groups the public squad by primary position', async () => {
    window.history.replaceState({}, '', '/players');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        if (String(input) === '/api/auth/me') {
          return Promise.resolve(mockResponse({}, 401));
        }
        if (String(input) === '/api/players') {
          return Promise.resolve(
            mockResponse(
              {
                players: [
                  {
                    additionalPositions: [],
                    createdAt: '',
                    description: 'Keeper.',
                    id: 'gk',
                    isActiveSquad: true,
                    name: 'Twiggy',
                    position: 'GK',
                    profilePictureUrl: null,
                  },
                  {
                    additionalPositions: [],
                    createdAt: '',
                    description: 'Defender.',
                    id: 'def',
                    isActiveSquad: true,
                    name: 'Doug',
                    position: 'DEF',
                    profilePictureUrl: null,
                  },
                  {
                    additionalPositions: [],
                    createdAt: '',
                    description: 'Midfielder.',
                    id: 'mid',
                    isActiveSquad: true,
                    name: 'Javi',
                    position: 'MID',
                    profilePictureUrl: null,
                  },
                  {
                    additionalPositions: [],
                    createdAt: '',
                    description: 'Attacker.',
                    id: 'fwd',
                    isActiveSquad: true,
                    name: 'Luke',
                    position: 'FWD',
                    profilePictureUrl: null,
                  },
                ],
                historicalPlayers: [
                  {
                    additionalPositions: [],
                    createdAt: '',
                    description: 'Historical player.',
                    id: 'historic',
                    isActiveSquad: false,
                    name: 'Birch',
                    position: null,
                    profilePictureUrl: null,
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
      await screen.findByRole('heading', { name: 'Keepers' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Defenders' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Midfielders' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Attackers' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Twiggy/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Luke/ })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Historical players' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Birch/ })).toBeInTheDocument();
  });

  it('renders the editable description, league position, and squad formation on the Home page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const path = String(input);
        if (path === '/api/auth/me') {
          return Promise.resolve(mockResponse({}, 401));
        }
        if (path === '/api/team-profile') {
          return Promise.resolve(
            mockResponse(
              {
                teamProfile: {
                  description: 'Sheffield football, friendship, and trophies.',
                  updatedAt: '2026-09-08T10:00:00.000Z',
                },
              },
              200,
            ),
          );
        }
        if (path === '/api/players') {
          return Promise.resolve(
            mockResponse(
              {
                players: [
                  {
                    createdAt: '2026-09-02T12:00:00.000Z',
                    description: 'Goalkeeper.',
                    id: 'goalkeeper',
                    isActiveSquad: true,
                    name: 'Gary Gloves',
                    position: 'GK',
                    profilePictureUrl: null,
                  },
                  {
                    createdAt: '2026-09-02T12:00:00.000Z',
                    description: 'Defender.',
                    id: 'defender',
                    isActiveSquad: true,
                    name: 'Dan Defence',
                    position: 'DEF',
                    profilePictureUrl: null,
                  },
                  {
                    createdAt: '2026-09-02T12:00:00.000Z',
                    description: 'Midfielder.',
                    id: 'midfielder',
                    isActiveSquad: true,
                    name: 'Mike Midfield',
                    position: 'MID',
                    profilePictureUrl: null,
                  },
                  {
                    createdAt: '2026-09-02T12:00:00.000Z',
                    description: 'Forward.',
                    id: 'forward',
                    isActiveSquad: true,
                    name: 'Frank Forward',
                    position: 'FWD',
                    profilePictureUrl: null,
                  },
                ],
              },
              200,
            ),
          );
        }
        if (path === '/api/standings/current') {
          return Promise.resolve(
            mockResponse(
              {
                lastUpdated: '2026-09-08T10:00:00.000Z',
                season: { id: 'season', name: 'Summer 2026' },
                standings: [
                  {
                    clubName: '24 Hour Party People',
                    drawn: 0,
                    ga: 8,
                    gd: 2,
                    gf: 10,
                    id: 'standing',
                    lost: 1,
                    played: 4,
                    points: 9,
                    position: 2,
                    scrapedAt: '2026-09-08T10:00:00.000Z',
                    walkoverGames: 0,
                    won: 3,
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
      await screen.findByText('Sheffield football, friendship, and trophies.'),
    ).toBeInTheDocument();
    expect(screen.getByText('2nd')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Current squad formation'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Gary Gloves/ })).toHaveAttribute(
      'href',
      '/players/goalkeeper',
    );
    expect(screen.getAllByText('Squad place')).toHaveLength(2);
  });

  it('lets an administrator update the Home page description', async () => {
    let submittedDescription: string | null = null;
    window.history.replaceState({}, '', '/admin/home-page');
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
          if (path === '/api/admin/team-profile' && !init?.method) {
            return Promise.resolve(
              mockResponse(
                {
                  teamProfile: {
                    description: 'Original description.',
                    updatedAt: '2026-09-08T10:00:00.000Z',
                  },
                },
                200,
              ),
            );
          }
          if (path === '/api/admin/team-profile' && init?.method === 'PUT') {
            submittedDescription = JSON.parse(String(init.body)).description;
            return Promise.resolve(
              mockResponse(
                {
                  teamProfile: {
                    description: submittedDescription,
                    updatedAt: '2026-09-08T10:01:00.000Z',
                  },
                },
                200,
              ),
            );
          }
          return Promise.resolve(mockResponse({}, 404));
        }),
    );

    render(<App />);

    const description = await screen.findByLabelText('Description');
    fireEvent.change(description, {
      target: { value: 'Updated Home page description.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save description' }));

    expect(
      await screen.findByText('The Home page description has been updated.'),
    ).toBeInTheDocument();
    expect(submittedDescription).toBe('Updated Home page description.');
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

  it('lets a player create an account and request an available profile', async () => {
    const playerId = '12c37c8a-6559-493b-9615-76ddab94dd66';
    let registration: Record<string, string> | null = null;
    window.history.replaceState({}, '', '/account');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
          const path = String(input);
          if (path === '/api/auth/me')
            return Promise.resolve(mockResponse({}, 401));
          if (path === '/api/auth/player-registration-options') {
            return Promise.resolve(
              mockResponse(
                {
                  players: [
                    { id: playerId, name: 'Alex Example', position: 'DEF' },
                  ],
                },
                200,
              ),
            );
          }
          if (path === '/api/auth/player-register' && init?.method === 'POST') {
            registration = JSON.parse(String(init.body));
            return Promise.resolve(
              mockResponse(
                {
                  user: {
                    email: 'alex@example.test',
                    id: 'account-id',
                    name: 'Alex',
                    playerId: null,
                    requestedPlayerId: playerId,
                    role: 'PLAYER',
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
    fireEvent.click(
      await screen.findByRole('button', { name: 'Create player account' }),
    );
    fireEvent.change(await screen.findByLabelText('Name'), {
      target: { value: 'Alex' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'alex@example.test' },
    });
    fireEvent.change(screen.getByLabelText(/^Password/), {
      target: { value: 'a secure player password' },
    });
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Create player account' })[1]!,
    );

    expect(
      await screen.findByRole('heading', { name: 'Profile request pending' }),
    ).toBeInTheDocument();
    expect(registration).toEqual({
      email: 'alex@example.test',
      name: 'Alex',
      password: 'a secure player password',
      playerId,
    });
  });

  it('lets an administrator approve a pending Player profile request', async () => {
    const accountId = '91ec5ba0-5a14-478d-b16d-83a3dcd5ff5e';
    const playerId = '12c37c8a-6559-493b-9615-76ddab94dd66';
    let approved = false;
    window.history.replaceState({}, '', '/admin/accounts');
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
                    id: 'admin-id',
                    name: 'Jack',
                    playerId: null,
                    requestedPlayerId: null,
                    role: 'ADMIN',
                  },
                },
                200,
              ),
            );
          }
          if (path === '/api/admin/accounts' && !init?.method) {
            return Promise.resolve(
              mockResponse(
                {
                  accounts: [
                    {
                      createdAt: '2026-09-09T00:00:00.000Z',
                      email: 'alex@example.test',
                      id: accountId,
                      name: 'Alex',
                      player: approved
                        ? { id: playerId, name: 'Alex Example' }
                        : null,
                      requestedPlayer: approved
                        ? null
                        : { id: playerId, name: 'Alex Example' },
                      role: 'PLAYER',
                    },
                  ],
                  players: [
                    {
                      id: playerId,
                      isActiveSquad: true,
                      name: 'Alex Example',
                      requestedBy: approved ? null : { id: accountId },
                      user: approved ? { id: accountId } : null,
                    },
                  ],
                },
                200,
              ),
            );
          }
          if (path === `/api/admin/accounts/${accountId}/approve`) {
            approved = true;
            return Promise.resolve(mockResponse({ account: {} }, 200));
          }
          return Promise.resolve(mockResponse({}, 404));
        }),
    );

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(
      await screen.findByText("Alex's profile request was approved."),
    ).toBeInTheDocument();
    expect(screen.getByText('Linked to Alex Example')).toBeInTheDocument();
  });

  it('lets the administrator update their normal login details', async () => {
    let accountUpdate: Record<string, string | null> | null = null;
    window.history.replaceState({}, '', '/admin/account');
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
                    email: 'old@example.test',
                    id: 'admin-id',
                    name: 'Jack',
                    playerId: null,
                    requestedPlayerId: null,
                    role: 'ADMIN',
                  },
                },
                200,
              ),
            );
          }
          if (path === '/api/admin/account' && init?.method === 'PUT') {
            accountUpdate = JSON.parse(String(init.body));
            return Promise.resolve(
              mockResponse(
                {
                  user: {
                    email: 'jackhumphreys.dev@gmail.com',
                    id: 'admin-id',
                    name: 'Jack Humphreys',
                    playerId: null,
                    requestedPlayerId: null,
                    role: 'ADMIN',
                  },
                },
                200,
              ),
            );
          }
          return Promise.resolve(mockResponse({}, 404));
        }),
    );

    render(<App />);
    fireEvent.change(await screen.findByLabelText('Name'), {
      target: { value: 'Jack Humphreys' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'owner.new@example.test' },
    });
    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'current secure password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save account' }));

    expect(
      await screen.findByText('Administrator account updated successfully.'),
    ).toBeInTheDocument();
    expect(accountUpdate).toEqual({
      currentPassword: 'current secure password',
      email: 'owner.new@example.test',
      name: 'Jack Humphreys',
      newPassword: null,
    });
  });

  it('shows the signed-in administrator in the website navigation', async () => {
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
        if (path === '/api/team-profile') {
          return Promise.resolve(
            mockResponse(
              {
                teamProfile: {
                  description: 'Team description.',
                  updatedAt: '2026-09-08T10:00:00.000Z',
                },
              },
              200,
            ),
          );
        }
        if (path === '/api/players') {
          return Promise.resolve(mockResponse({ players: [] }, 200));
        }
        return Promise.resolve(
          mockResponse({ lastUpdated: null, season: null, standings: [] }, 200),
        );
      }),
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
    expect(screen.getByLabelText('Primary position')).toHaveValue('DEF');
    const midfield = screen.getByRole('checkbox', { name: 'Midfielder' });
    const forward = screen.getByRole('checkbox', { name: 'Forward' });
    fireEvent.click(midfield);
    fireEvent.click(forward);
    expect(midfield).toBeChecked();
    expect(forward).toBeChecked();
    expect(
      screen.queryByRole('checkbox', { name: 'Defender' }),
    ).not.toBeInTheDocument();
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

  it('lets an administrator refresh cached Powerleague data', async () => {
    window.history.replaceState({}, '', '/admin/standings');
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
        if (path === '/api/admin/scrape/refresh') {
          return Promise.resolve(
            mockResponse(
              {
                imported: {
                  fixturesImported: 2,
                  resultsImported: 16,
                  standingsImported: 10,
                },
                scrapeStatus: {
                  lastAttemptedAt: '2026-09-08T08:30:00.000Z',
                  lastSucceededAt: '2026-09-08T08:30:00.000Z',
                  latestRefreshFailed: false,
                },
              },
              200,
            ),
          );
        }
        if (path === '/api/admin/standings') {
          return Promise.resolve(
            mockResponse(
              {
                lastUpdated: null,
                scrapeStatus: {
                  lastAttemptedAt: null,
                  lastSucceededAt: null,
                  latestRefreshFailed: false,
                },
                season: { id: 'season', name: 'Summer 2026' },
                standings: [],
              },
              200,
            ),
          );
        }
        return Promise.resolve(mockResponse({}, 404));
      }),
    );

    render(<App />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Refresh from Powerleague' }),
    );

    expect(
      await screen.findByText(
        'Powerleague refreshed: 10 standings rows, 2 fixtures and 16 new results imported.',
      ),
    ).toBeInTheDocument();
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

  it('lets an administrator save player contributions for a tracked game', async () => {
    const gameId = 'e2032560-3b69-4ee6-90f5-79806fe48acb';
    const playerId = '9c0846a0-0c65-4a60-8a64-d735d78d00ca';
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
            return Promise.resolve(mockResponse({ seasons: [] }, 200));
          }
          if (path === '/api/admin/games/player-stats') {
            return Promise.resolve(
              mockResponse(
                {
                  games: [
                    {
                      competition: 'LEAGUE',
                      datePlayed: '2026-10-06T00:00:00.000Z',
                      id: gameId,
                      opponentClub: { name: 'Norton Rivals' },
                      opponentScore: 0,
                      ourScore: 3,
                      playerStats: [],
                      season: { id: 'next-season', name: 'Autumn 2026' },
                    },
                  ],
                  players: [
                    {
                      id: playerId,
                      isActiveSquad: true,
                      name: 'Luke',
                      position: 'FWD',
                    },
                  ],
                },
                200,
              ),
            );
          }
          if (
            path === `/api/admin/games/${gameId}/player-stats` &&
            init?.method === 'PUT'
          ) {
            submittedBody = JSON.parse(String(init.body));
            return Promise.resolve(
              mockResponse(
                {
                  playerStats: [
                    {
                      assists: 1,
                      cleanSheet: true,
                      goals: 2,
                      playerId,
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
      await screen.findByRole('heading', { name: 'Per-game statistics' }),
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Luke' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Goals' }), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Assists' }), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Clean sheet' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Save player statistics' }),
    );

    expect(
      await screen.findByText('Player contributions saved successfully.'),
    ).toBeInTheDocument();
    expect(submittedBody).toEqual({
      playerStats: [
        {
          assists: 1,
          cleanSheet: true,
          goals: 2,
          playerId,
        },
      ],
    });
  });
});

describe('club history', () => {
  it('renders finalised season finishes on the public route', async () => {
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
                  finalisedAt: '2026-09-01T10:00:00.000Z',
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

  it('finalises an eligible season from the administrator route', async () => {
    const seasonId = '12c37c8a-6559-493b-9615-76ddab94dd66';
    let finalised = false;
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
            path === `/api/admin/club-history/${seasonId}/finalise` &&
            init?.method === 'POST'
          ) {
            finalised = true;
            return Promise.resolve(
              mockResponse(
                {
                  history: {
                    clubName: '24 Hour Party People',
                    drawn: 2,
                    finalisedAt: '2026-09-01T10:00:00.000Z',
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
      await screen.findByRole('heading', { name: 'Finalise club history' }),
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Finalise' }));

    expect(
      await screen.findByText('Summer 2026 was added to club history.'),
    ).toBeInTheDocument();
    expect(finalised).toBe(true);
    expect(
      screen.getByText('No ended seasons are waiting to be finalised.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('rowheader', { name: 'Summer 2026' }),
    ).toBeInTheDocument();
  });
});
