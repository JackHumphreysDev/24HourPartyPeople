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
  clubName: string;
  finalisedAt: string;
  id: string;
  season: {
    endDate: string;
    id: string;
    name: string;
    startDate: string;
  };
};

export type ClubHistoryCandidate = {
  endDate: string;
  id: string;
  name: string;
  standing: ClubHistoryStanding | null;
  startDate: string;
};

export type AdminClubHistory = {
  candidates: ClubHistoryCandidate[];
  history: ClubHistoryEntry[];
};
