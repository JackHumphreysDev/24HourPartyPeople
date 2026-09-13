import { describe, expect, it } from 'vitest';

import { calculateSeasonForm } from './form';
import type { Competition, GameSummary } from './types';

function game(
  id: string,
  date: string,
  competition: Competition,
  ourScore: number | null,
  opponentScore: number | null,
  seasonId = 'current',
): GameSummary {
  return {
    competition,
    createdAt: `${date}T21:00:00.000Z`,
    datePlayed: `${date}T00:00:00.000Z`,
    fixtureId: null,
    id,
    isWalkover: ourScore === null,
    opponentClub: { id: `opponent-${id}`, name: `Opponent ${id}` },
    opponentScore,
    ourScore,
    season: { id: seasonId, name: seasonId },
    walkoverReason: ourScore === null ? 'Fixture forfeited' : null,
  };
}

const games = [
  game('oct-8', '2026-10-08', 'LEAGUE', 0, 2),
  game('oct-1', '2026-10-01', 'CUP', 3, 1),
  game('sep-24', '2026-09-24', 'LEAGUE', 2, 2),
  game('sep-17', '2026-09-17', 'LEAGUE', 2, 0),
  game('sep-10', '2026-09-10', 'CUP', 1, 3),
  game('sep-3', '2026-09-03', 'LEAGUE', 4, 1),
  game('walkover', '2026-09-02', 'LEAGUE', null, null),
  game('historic', '2025-08-01', 'LEAGUE', 7, 0, 'historic'),
];

describe('season form', () => {
  it('calculates season totals, last-five form, and chronological goal-difference trend', () => {
    const form = calculateSeasonForm(games, 'current', 'ALL');

    expect(form).toMatchObject({
      draws: 1,
      goalDifference: 3,
      goalsAgainst: 9,
      goalsFor: 12,
      losses: 2,
      scoredGames: 6,
      walkovers: 1,
      wins: 3,
    });
    expect(form.form.map(({ outcome }) => outcome)).toEqual([
      'L',
      'W',
      'D',
      'W',
      'L',
    ]);
    expect(form.trend.map((point) => point.runningGoalDifference)).toEqual([
      3, 1, 3, 3, 5, 3,
    ]);
    expect(form.trend.map((point) => point.game.id)).toEqual([
      'sep-3',
      'sep-10',
      'sep-17',
      'sep-24',
      'oct-1',
      'oct-8',
    ]);
  });

  it('separates league and cup results without counting walkovers as wins', () => {
    expect(calculateSeasonForm(games, 'current', 'LEAGUE')).toMatchObject({
      draws: 1,
      goalDifference: 3,
      goalsAgainst: 5,
      goalsFor: 8,
      losses: 1,
      scoredGames: 4,
      walkovers: 1,
      wins: 2,
    });
    expect(calculateSeasonForm(games, 'current', 'CUP')).toMatchObject({
      goalDifference: 0,
      goalsAgainst: 4,
      goalsFor: 4,
      scoredGames: 2,
      walkovers: 0,
    });
  });

  it('keeps seasons separate and handles a view with no scored games', () => {
    expect(calculateSeasonForm(games, 'historic', 'ALL')).toMatchObject({
      goalDifference: 7,
      scoredGames: 1,
      wins: 1,
    });
    expect(calculateSeasonForm([games[6]!], 'current', 'LEAGUE')).toMatchObject(
      {
        form: [],
        scoredGames: 0,
        trend: [],
        walkovers: 1,
      },
    );
  });

  it('orders form and trend by match date even if games arrive out of order', () => {
    const form = calculateSeasonForm([...games].reverse(), 'current', 'ALL');

    expect(form.form.map(({ outcome }) => outcome)).toEqual([
      'L',
      'W',
      'D',
      'W',
      'L',
    ]);
    expect(form.trend.at(-1)?.runningGoalDifference).toBe(3);
  });
});
