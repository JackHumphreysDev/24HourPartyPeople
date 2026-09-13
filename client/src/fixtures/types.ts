import type { Competition } from '../games/types';
import type { ScrapeStatus } from '../scrape/types';

export type FixtureStatus = 'SCHEDULED' | 'PLAYED' | 'WALKOVER' | 'CANCELLED';
export type FixtureSource = 'SCRAPE' | 'MANUAL';
export type AvailabilityResponse = 'AVAILABLE' | 'UNSURE' | 'UNAVAILABLE';

export type OwnFixtureAvailability = {
  fixtureId: string;
  response: AvailabilityResponse;
};

export type AdminFixtureAvailability = {
  id: string;
  availability: {
    player: { id: string; name: string };
    response: AvailabilityResponse;
    updatedAt: string;
  }[];
};

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

export type FixturesSnapshot = {
  fixtures: FixtureSummary[];
  scrapeStatus: ScrapeStatus;
};
