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
});
