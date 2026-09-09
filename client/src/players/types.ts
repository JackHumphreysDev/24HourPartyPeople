export type PlayerPosition = 'GK' | 'DEF' | 'MID' | 'FWD';

export type PlayerSummary = {
  additionalPositions: PlayerPosition[];
  createdAt: string;
  description: string;
  id: string;
  isActiveSquad: boolean;
  isOnBench: boolean;
  name: string;
  position: PlayerPosition | null;
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
  additionalPositions: PlayerPosition[];
  description: string;
  image: File | null;
  isActiveSquad: boolean;
  isOnBench: boolean;
  name: string;
  position: PlayerPosition | null;
  removeProfilePicture: boolean;
};

export type SeasonSummary = {
  endDate: string;
  id: string;
  isCurrent: boolean;
  name: string;
  startDate: string;
  tracksGamesPlayed: boolean;
};

export type SeasonInput = {
  endDate: string;
  isCurrent: boolean;
  name: string;
  startDate: string;
  tracksGamesPlayed: boolean;
};

export type AdminSeasonStat = {
  assists: number;
  cleanSheets: number;
  gamesPlayed: number | null;
  goals: number;
  id: string;
  note: string | null;
  seasonId: string;
};

export type SeasonStatInput = {
  assists: number;
  cleanSheets: number;
  gamesPlayed: number | null;
  goals: number;
  note: string | null;
  seasonId: string;
};

export const positionLabels: Record<PlayerPosition, string> = {
  GK: 'Goalkeeper',
  DEF: 'Defender',
  MID: 'Midfielder',
  FWD: 'Forward',
};
