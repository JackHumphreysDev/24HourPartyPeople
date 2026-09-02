import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  registerAdmin as registerAdminRequest,
} from './api';
import { AuthContext } from './context';
import type {
  AuthStatus,
  AuthUser,
  LoginInput,
  RegisterAdminInput,
} from './types';

type AuthProviderProps = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    const controller = new AbortController();

    void getCurrentUser(controller.signal)
      .then((currentUser) => {
        setUser(currentUser);
        setStatus(currentUser ? 'authenticated' : 'anonymous');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        setUser(null);
        setStatus('anonymous');
      });

    return () => controller.abort();
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const authenticatedUser = await loginRequest(input);
    setUser(authenticatedUser);
    setStatus('authenticated');
  }, []);

  const registerAdmin = useCallback(async (input: RegisterAdminInput) => {
    const authenticatedUser = await registerAdminRequest(input);
    setUser(authenticatedUser);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(
    () => ({ login, logout, registerAdmin, status, user }),
    [login, logout, registerAdmin, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
