import { describe, expect, it } from 'vitest';

import { calculateOpponentRecords } from './headToHead';
import type { Competition, GameSummary } from './types';

function game(
  id: string,
  opponentId: string,
  opponentName: string,
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
    opponentClub: { id: opponentId, name: opponentName },
    opponentScore,
    ourScore,
    season: { id: seasonId, name: seasonId },
    walkoverReason: ourScore === null ? 'Fixture forfeited' : null,
  };
}

describe('opponent records', () => {
  it('groups league and cup results across seasons by opponent', () => {
    const records = calculateOpponentRecords([
      game('loss', 'norton', 'Norton Rivals', '2026-09-10', 'LEAGUE', 1, 3),
      game('win', 'norton', 'Norton Rivals', '2025-09-10', 'CUP', 4, 2, 'old'),
      game('draw', 'norton', 'Norton Rivals', '2026-09-03', 'LEAGUE', 2, 2),
      game('other', 'abbey', 'Abbey', '2026-09-01', 'LEAGUE', 1, 0),
    ]);

    expect(records.map((record) => record.name)).toEqual([
      'Abbey',
      'Norton Rivals',
    ]);
    expect(records[1]).toMatchObject({
      draws: 1,
      goalsAgainst: 7,
      goalsFor: 7,
      losses: 1,
      scoredGames: 3,
      walkovers: 0,
      wins: 1,
    });
    expect(records[1]?.games.map((match) => match.id)).toEqual([
      'loss',
      'draw',
      'win',
    ]);
  });

  it('keeps walkovers and missing scores out of scored records', () => {
    const missingScore = game(
      'missing',
      'norton',
      'Norton Rivals',
      '2026-09-11',
      'CUP',
      1,
      null,
    );
    const [record] = calculateOpponentRecords([
      game(
        'walkover',
        'norton',
        'Norton Rivals',
        '2026-09-12',
        'LEAGUE',
        null,
        null,
      ),
      missingScore,
    ]);

    expect(record).toMatchObject({
      draws: 0,
      goalsAgainst: 0,
      goalsFor: 0,
      losses: 0,
      scoredGames: 0,
      walkovers: 1,
      wins: 0,
    });
    expect(record?.games).toHaveLength(2);
  });

  it('returns no records when there are no games', () => {
    expect(calculateOpponentRecords([])).toEqual([]);
  });
});
