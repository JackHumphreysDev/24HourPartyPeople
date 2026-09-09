export type HistoricalPlayerStat = {
  assists?: number;
  cleanSheets?: number;
  goals?: number;
  note?: string;
  player: string;
};

export type HistoricalSeason = {
  current?: boolean;
  endDate?: string;
  name: string;
  startDate?: string;
  stats: HistoricalPlayerStat[];
};

export const historicalSeasons: HistoricalSeason[] = [
  {
    current: true,
    name: 'Summer 2026',
    stats: [
      {
        assists: 11,
        goals: 20,
        note: 'Includes 1 cup goal. League goals included 2 right-footed goals, 1 free kick and 1 corner.',
        player: 'Luke',
      },
      {
        assists: 14,
        goals: 9,
        note: 'Includes 1 cup goal and 2 cup assists.',
        player: 'Javi',
      },
      { goals: 3, player: 'Birch' },
      { assists: 3, goals: 3, player: 'Doug' },
      { assists: 7, goals: 3, player: 'Broomhead' },
      { assists: 2, goals: 2, player: 'Andy' },
      {
        assists: 4,
        goals: 3,
        note: 'Includes 2 cup goals and 2 cup assists.',
        player: 'Bill',
      },
      { assists: 1, goals: 1, player: 'Horse' },
      { goals: 1, player: 'Matt' },
      { cleanSheets: 6, player: 'Twiggy' },
      { cleanSheets: 1, player: 'Dav' },
    ],
  },
  {
    endDate: '2026-04-30',
    name: 'April 2026',
    startDate: '2026-01-01',
    stats: [
      {
        assists: 11,
        goals: 26,
        note: 'Includes 1 cup goal. League goals included 3 right-footed goals and 1 penalty.',
        player: 'Luke',
      },
      {
        assists: 5,
        goals: 7,
        note: 'League goals included 3 right-footed goals.',
        player: 'Broomhead',
      },
      {
        assists: 20,
        goals: 7,
        note: 'Includes 1 cup goal and 1 cup assist.',
        player: 'Javi',
      },
      {
        assists: 5,
        goals: 6,
        note: 'League goals included 4 left-footed goals.',
        player: 'Kyle',
      },
      { assists: 3, goals: 5, player: 'Ade' },
      { goals: 4, player: 'Bill' },
      {
        assists: 7,
        cleanSheets: 1,
        goals: 4,
        note: 'Includes 1 cup assist.',
        player: 'Doug',
      },
      { assists: 6, goals: 3, player: 'Andy' },
      { assists: 5, goals: 2, player: 'Horse' },
      { assists: 1, cleanSheets: 8, player: 'Twiggy' },
    ],
  },
  {
    endDate: '2025-12-31',
    name: 'December 2025',
    startDate: '2025-09-01',
    stats: [
      {
        assists: 9,
        goals: 11,
        note: 'Goals included 1 penalty.',
        player: 'Luke',
      },
      { assists: 4, goals: 8, player: 'Javi' },
      { assists: 2, goals: 3, player: 'Ade' },
      { assists: 3, goals: 3, player: 'Broomhead' },
      { assists: 1, goals: 1, player: 'Kyle' },
      { assists: 5, player: 'Horse' },
      { assists: 2, player: 'Boz' },
      { cleanSheets: 2, player: 'Twiggy' },
      { cleanSheets: 1, player: 'Danny' },
    ],
  },
  {
    endDate: '2025-08-31',
    name: 'August 2025',
    startDate: '2025-06-01',
    stats: [
      { assists: 4, goals: 16, player: 'Ade' },
      {
        assists: 11,
        goals: 14,
        note: 'Goals included 1 direct corner and 1 free kick.',
        player: 'Luke',
      },
      {
        assists: 11,
        goals: 12,
        note: 'Goals included 1 left-footed goal and 1 back heel.',
        player: 'Javi',
      },
      { assists: 3, goals: 2, player: 'Boz' },
      { assists: 2, goals: 2, player: 'Tom' },
      { goals: 1, player: 'Broomhead' },
      { assists: 2, goals: 1, player: 'Theo' },
      { assists: 6, player: 'Horse' },
      { assists: 3, player: 'Birch' },
      { assists: 3, player: 'Doug' },
      { assists: 1, player: 'Twiggy' },
    ],
  },
  {
    endDate: '2025-05-31',
    name: 'May 2025',
    startDate: '2025-03-01',
    stats: [
      {
        assists: 3,
        goals: 24,
        note: 'Goals included 3 direct free kicks, 2 right-footed goals and 1 header.',
        player: 'Luke',
      },
      { assists: 11, goals: 7, player: 'Javi' },
      { assists: 5, goals: 2, player: 'Bart' },
      { assists: 2, goals: 2, player: 'Birch' },
      { assists: 3, goals: 2, player: 'Sam' },
      { goals: 1, player: 'Boz' },
      { assists: 2, goals: 1, player: 'Broomhead' },
      { assists: 3, player: 'Horse' },
      { assists: 3, cleanSheets: 6, player: 'Twiggy' },
      { assists: 1, player: 'Dan' },
      { assists: 1, player: 'Kraus' },
      { assists: 1, player: 'Tom' },
    ],
  },
  {
    endDate: '2025-02-28',
    name: 'February 2025',
    startDate: '2024-12-01',
    stats: [
      {
        assists: 10,
        goals: 18,
        note: 'Goals included 2 right-footed goals.',
        player: 'Luke',
      },
      { assists: 5, goals: 7, player: 'Javi' },
      {
        assists: 6,
        goals: 5,
        note: 'Goals included 2 right-footed goals.',
        player: 'Broomhead',
      },
      { assists: 10, goals: 3, player: 'Doug' },
      { goals: 1, player: 'Dan' },
      { goals: 1, player: 'Horse' },
      { assists: 2, cleanSheets: 4, player: 'Twiggy' },
      { assists: 1, player: 'Dav' },
    ],
  },
  {
    endDate: '2024-11-30',
    name: 'November 2024',
    startDate: '2024-08-01',
    stats: [
      {
        assists: 16,
        goals: 23,
        note: 'Goals included 3 free kicks, 1 penalty and 2 right-footed goals.',
        player: 'Luke',
      },
      { assists: 13, goals: 9, player: 'Javi' },
      { assists: 2, goals: 7, player: 'Kyle' },
      { assists: 4, goals: 5, player: 'Broomhead' },
      { assists: 1, goals: 3, player: 'Dan' },
      { assists: 4, goals: 3, player: 'Doug' },
      { goals: 1, player: 'Boz' },
      { assists: 3, player: 'Horse' },
      { assists: 1, cleanSheets: 1, player: 'Bobo' },
      { cleanSheets: 8, note: 'Includes 1 cup clean sheet.', player: 'Twiggy' },
    ],
  },
  {
    endDate: '2024-07-31',
    name: 'July 2024',
    startDate: '2024-05-01',
    stats: [
      {
        assists: 3,
        goals: 17,
        note: 'Goals included 1 direct free kick and 3 right-footed goals.',
        player: 'Luke',
      },
      { assists: 8, goals: 8, player: 'Javi' },
      {
        assists: 5,
        goals: 6,
        note: 'Goals included 3 right-footed goals.',
        player: 'Broomhead',
      },
      { assists: 3, goals: 4, player: 'Doug' },
      {
        assists: 3,
        goals: 2,
        note: 'Goals included 1 left-footed goal.',
        player: 'Birch',
      },
      {
        assists: 6,
        cleanSheets: 6,
        goals: 1,
        note: 'Goal recorded as TV in the source tally.',
        player: 'Twiggy',
      },
      { assists: 3, player: 'Bart' },
      { assists: 2, player: 'Boz' },
      { assists: 2, player: 'Horse' },
    ],
  },
  {
    endDate: '2024-04-30',
    name: 'April 2024',
    startDate: '2024-01-01',
    stats: [
      {
        assists: 6,
        goals: 15,
        note: 'Includes 2 cup goals. League goals included 1 right-footed goal and 1 direct free kick.',
        player: 'Luke',
      },
      {
        goals: 7,
        note: 'Includes 2 cup goals.',
        player: 'Broomhead',
      },
      {
        assists: 5,
        goals: 4,
        note: 'Includes 1 cup goal. League goals included 1 left-footed goal.',
        player: 'Birch',
      },
      {
        assists: 2,
        goals: 5,
        note: 'Includes 2 cup goals. League goals included 1 left-footed goal.',
        player: 'Javi',
      },
      { assists: 1, goals: 2, player: 'Doug' },
      { assists: 3, player: 'Boz' },
      {
        assists: 2,
        cleanSheets: 5,
        note: 'Includes 1 cup clean sheet.',
        player: 'Twiggy',
      },
      { assists: 1, player: 'Horse' },
    ],
  },
];
