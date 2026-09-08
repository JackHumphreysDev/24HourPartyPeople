import type { UserRole } from '../generated/prisma/enums.js';

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  playerId: string | null;
  requestedPlayerId: string | null;
  role: UserRole;
};
