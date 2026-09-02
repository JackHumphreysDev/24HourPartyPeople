import type { AuthUser, LoginInput, RegisterAdminInput } from './types';

type ErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

type AuthResponse = {
  user: AuthUser;
};

function isErrorResponse(value: unknown): value is ErrorResponse {
  return typeof value === 'object' && value !== null && 'error' in value;
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body: unknown = await readJson<unknown>(response).catch(() => null);
    const apiError = isErrorResponse(body) ? body.error : undefined;
    throw new AuthApiError(
      apiError?.message ?? 'The request could not be completed.',
      response.status,
      apiError?.code,
    );
  }

  return readJson<T>(response);
}

export async function getCurrentUser(
  signal?: AbortSignal,
): Promise<AuthUser | null> {
  try {
    const response = await authRequest<AuthResponse>('/api/auth/me', {
      method: 'GET',
      signal,
    });
    return response.user;
  } catch (error) {
    if (error instanceof AuthApiError && error.status === 401) {
      return null;
    }

    throw error;
  }
}

export async function login(input: LoginInput): Promise<AuthUser> {
  const response = await authRequest<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.user;
}

export async function registerAdmin(
  input: RegisterAdminInput,
): Promise<AuthUser> {
  const response = await authRequest<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.user;
}

export async function logout(): Promise<void> {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new AuthApiError('Sign out could not be completed.', response.status);
  }
}
