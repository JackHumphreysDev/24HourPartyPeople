import type { AuthUser } from './types';

export function canManageContent(user: AuthUser | null): boolean {
  return user?.role === 'ADMIN' || user?.role === 'SUB_ADMIN';
}

export function canUsePlayerProfile(user: AuthUser | null): boolean {
  return user?.role === 'PLAYER' || user?.role === 'SUB_ADMIN';
}
