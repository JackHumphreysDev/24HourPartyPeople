export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'PLAYER';
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterAdminInput = LoginInput & {
  name: string;
  setupKey: string;
};

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';
