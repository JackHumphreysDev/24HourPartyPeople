export type PlayerAccount = {
  createdAt: string;
  email: string;
  id: string;
  name: string;
  player: { id: string; name: string } | null;
  requestedPlayer: { id: string; name: string } | null;
  role: 'PLAYER';
};

export type AccountPlayer = {
  id: string;
  isActiveSquad: boolean;
  name: string;
  requestedBy: { id: string } | null;
  user: { id: string } | null;
};

export type AccountsSnapshot = {
  accounts: PlayerAccount[];
  players: AccountPlayer[];
};
