import { createContext } from 'react';

import type {
  AuthStatus,
  AuthUser,
  LoginInput,
  RegisterPlayerInput,
  AccountUpdateInput,
} from './types';

export type AuthContextValue = {
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  registerPlayer: (input: RegisterPlayerInput) => Promise<void>;
  requestPlayerProfile: (playerId: string) => Promise<void>;
  updateAdminAccount: (input: AccountUpdateInput) => Promise<void>;
  updatePlayerAccount: (input: AccountUpdateInput) => Promise<void>;
  status: AuthStatus;
  user: AuthUser | null;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
