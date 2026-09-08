export type AuthUser = {
  id: string;
  name: string;
  email: string;
  playerId: string | null;
  requestedPlayerId: string | null;
  role: 'ADMIN' | 'PLAYER';
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterPlayerInput = LoginInput & {
  name: string;
  playerId: string;
};

export type RegistrationPlayer = {
  id: string;
  name: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
};

export type AdminAccountInput = {
  currentPassword: string;
  email: string;
  name: string;
  newPassword: string | null;
};

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';
