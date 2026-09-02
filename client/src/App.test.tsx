import { render, screen } from '@testing-library/react';
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
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('renders the team name and sign-in screen for an anonymous visitor', async () => {
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
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeInTheDocument();
  });

  it('renders the signed-in state returned by the session API', async () => {
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

    expect(await screen.findByText('Welcome, Jack')).toBeInTheDocument();
    expect(screen.getByText('Administrator access active')).toBeInTheDocument();
  });
});
