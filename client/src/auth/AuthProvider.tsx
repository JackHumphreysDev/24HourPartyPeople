import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  registerPlayer as registerPlayerRequest,
  requestPlayerProfile as requestPlayerProfileRequest,
  updateAdminAccount as updateAdminAccountRequest,
} from './api';
import { AuthContext } from './context';
import type {
  AuthStatus,
  AuthUser,
  LoginInput,
  RegisterPlayerInput,
  AdminAccountInput,
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

  const registerPlayer = useCallback(async (input: RegisterPlayerInput) => {
    const authenticatedUser = await registerPlayerRequest(input);
    setUser(authenticatedUser);
    setStatus('authenticated');
  }, []);

  const updateAdminAccount = useCallback(async (input: AdminAccountInput) => {
    const authenticatedUser = await updateAdminAccountRequest(input);
    setUser(authenticatedUser);
  }, []);

  const requestPlayerProfile = useCallback(async (playerId: string) => {
    const authenticatedUser = await requestPlayerProfileRequest(playerId);
    setUser(authenticatedUser);
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(
    () => ({
      login,
      logout,
      registerPlayer,
      requestPlayerProfile,
      status,
      updateAdminAccount,
      user,
    }),
    [
      login,
      logout,
      registerPlayer,
      requestPlayerProfile,
      status,
      updateAdminAccount,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
