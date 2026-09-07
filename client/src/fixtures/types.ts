import type { Competition } from '../games/types';

export type FixtureStatus = 'SCHEDULED' | 'PLAYED' | 'WALKOVER';
export type FixtureSource = 'SCRAPE' | 'MANUAL';

export type FixtureSummary = {
  competition: Competition;
  id: string;
  opponentClub: {
    id: string;
    name: string;
  };
  result: { id: string } | null;
  scheduledDate: string;
  scheduledTime: string | null;
  season: {
    id: string;
    name: string;
  };
  source: FixtureSource;
  status: FixtureStatus;
  venue: string | null;
};

export type FixtureInput = {
  competition: Competition;
  opponentName: string;
  scheduledDate: string;
  scheduledTime: string | null;
  seasonId: string;
  venue: string | null;
};
