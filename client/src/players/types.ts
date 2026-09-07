export type PlayerPosition = 'GK' | 'DEF' | 'MID' | 'FWD';

export type PlayerSummary = {
  createdAt: string;
  description: string;
  id: string;
  isActiveSquad: boolean;
  name: string;
  position: PlayerPosition;
  profilePictureUrl: string | null;
};

export type PlayerSeasonStat = {
  assists: number;
  cleanSheets: number;
  gamesPlayed: number | null;
  goals: number;
  id: string;
  note: string | null;
  season: {
    endDate: string;
    id: string;
    isCurrent: boolean;
    name: string;
    startDate: string;
  };
};

export type PlayerDetail = PlayerSummary & {
  seasonStats: PlayerSeasonStat[];
};

export type PlayerInput = {
  description: string;
  image: File | null;
  isActiveSquad: boolean;
  name: string;
  position: PlayerPosition;
  removeProfilePicture: boolean;
};

export const positionLabels: Record<PlayerPosition, string> = {
  GK: 'Goalkeeper',
  DEF: 'Defender',
  MID: 'Midfielder',
  FWD: 'Forward',
};
