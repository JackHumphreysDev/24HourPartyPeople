import { createContext } from 'react';

import type {
  AuthStatus,
  AuthUser,
  LoginInput,
  RegisterAdminInput,
} from './types';

export type AuthContextValue = {
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  registerAdmin: (input: RegisterAdminInput) => Promise<void>;
  status: AuthStatus;
  user: AuthUser | null;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
