export type Competition = 'LEAGUE' | 'CUP';

export type GameSummary = {
  competition: Competition;
  createdAt: string;
  datePlayed: string;
  fixtureId: string | null;
  id: string;
  isWalkover: boolean;
  opponentClub: {
    id: string;
    name: string;
  };
  opponentScore: number | null;
  ourScore: number | null;
  season: {
    id: string;
    name: string;
  };
  walkoverReason: string | null;
};

export type AdminFixture = {
  competition: Competition;
  id: string;
  opponentClub: {
    id: string;
    name: string;
  };
  scheduledDate: string;
  scheduledTime: string | null;
  season: {
    id: string;
    name: string;
  };
  source: 'SCRAPE' | 'MANUAL';
  venue: string | null;
};

type ResultValues = {
  isWalkover: boolean;
  opponentScore: number | null;
  ourScore: number | null;
  walkoverReason: string | null;
};

export type GameResultInput =
  | (ResultValues & {
      entryMode: 'fixture';
      fixtureId: string;
    })
  | (ResultValues & {
      competition: Competition;
      datePlayed: string;
      entryMode: 'manual';
      opponentName: string;
      seasonId: string;
    });

export type CreatedGameResult = {
  game: GameSummary;
  standingsRefreshRequired: boolean;
};
