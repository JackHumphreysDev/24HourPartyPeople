import { describe, expect, it } from 'vitest';

import { historicalSeasons } from '../src/statistics/historicalData.js';

describe('historical season statistics data', () => {
  it('contains the approved seasons and excludes own goals', () => {
    expect(historicalSeasons).toHaveLength(9);
    expect(historicalSeasons.filter((season) => season.current)).toHaveLength(
      1,
    );
    expect(historicalSeasons[0]?.name).toBe('Summer 2026');
    expect(
      historicalSeasons
        .flatMap((season) => season.stats)
        .map((stat) => stat.player),
    ).not.toContain('OG');
  });

  it('combines the supplied league and cup contributions', () => {
    const summer = historicalSeasons.find(
      (season) => season.name === 'Summer 2026',
    );
    expect(summer?.stats.find((stat) => stat.player === 'Luke')).toMatchObject({
      assists: 11,
      goals: 20,
    });
    expect(summer?.stats.find((stat) => stat.player === 'Javi')).toMatchObject({
      assists: 14,
      goals: 9,
    });
    expect(summer?.stats.find((stat) => stat.player === 'Bill')).toMatchObject({
      assists: 4,
      goals: 3,
    });
    const november = historicalSeasons.find(
      (season) => season.name === 'November 2024',
    );
    expect(
      november?.stats.find((stat) => stat.player === 'Twiggy')?.cleanSheets,
    ).toBe(8);
    const april = historicalSeasons.find(
      (season) => season.name === 'April 2024',
    );
    expect(april?.stats.find((stat) => stat.player === 'Luke')?.goals).toBe(15);
    expect(
      april?.stats.find((stat) => stat.player === 'Broomhead')?.goals,
    ).toBe(7);
    expect(april?.stats.find((stat) => stat.player === 'Javi')?.goals).toBe(5);
    expect(april?.stats.find((stat) => stat.player === 'Birch')?.goals).toBe(4);
    expect(
      april?.stats.find((stat) => stat.player === 'Twiggy')?.cleanSheets,
    ).toBe(5);
  });

  it('keeps every historical statistic free of games-played estimates', () => {
    expect(
      historicalSeasons.every((season) =>
        season.stats.every((stat) => !('gamesPlayed' in stat)),
      ),
    ).toBe(true);
  });
});
