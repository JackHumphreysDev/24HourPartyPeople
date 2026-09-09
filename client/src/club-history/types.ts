export type ClubHistoryStanding = {
  drawn: number;
  ga: number;
  gd: number;
  gf: number;
  lost: number;
  played: number;
  points: number;
  position: number;
  walkoverGames: number;
  won: number;
};

export type ClubHistoryEntry = ClubHistoryStanding & {
  awards: {
    assistKing: SeasonAward;
    goldenBoot: SeasonAward;
    goldenGlove: SeasonAward;
  };
  clubName: string;
  finalisedAt: string;
  id: string;
  season: {
    endDate: string;
    id: string;
    name: string;
    startDate: string;
  };
  squad: SeasonSquadEntry[];
};

export type HistoryPlayer = {
  id: string;
  isActiveSquad: boolean;
  isOnBench: boolean;
  name: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD' | null;
  profilePictureUrl: string | null;
};

export type SeasonSquadEntry = {
  id?: string;
  isStarter: boolean;
  player: Pick<HistoryPlayer, 'id' | 'name' | 'profilePictureUrl'>;
  playerId: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
};

export type SeasonAward = {
  players: Array<{ id: string; name: string }>;
  value: number;
};

export type ClubHistorySeason = {
  canFinalise: boolean;
  endDate: string;
  id: string;
  isCurrent: boolean;
  name: string;
  squadEntries: SeasonSquadEntry[];
  standing: ClubHistoryStanding | null;
  startDate: string;
  suggestedSquad: SeasonSquadEntry[];
  tracksGamesPlayed: boolean;
};

export type AdminClubHistory = {
  history: ClubHistoryEntry[];
  players: HistoryPlayer[];
  seasons: ClubHistorySeason[];
};

export type SeasonSquadInput = Array<{
  isStarter: boolean;
  playerId: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
}>;
