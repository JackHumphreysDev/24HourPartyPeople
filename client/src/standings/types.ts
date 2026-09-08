export type StandingRow = {
  clubName: string;
  drawn: number;
  ga: number;
  gd: number;
  gf: number;
  id: string;
  lost: number;
  played: number;
  points: number;
  position: number;
  scrapedAt: string;
  walkoverGames: number;
  won: number;
};

export type StandingRowInput = Omit<StandingRow, 'gd' | 'id' | 'scrapedAt'>;

export type StandingsSnapshot = {
  lastUpdated: string | null;
  scrapeStatus: ScrapeStatus;
  season: {
    id: string;
    name: string;
  } | null;
  standings: StandingRow[];
};
import type { ScrapeStatus } from '../scrape/types';
