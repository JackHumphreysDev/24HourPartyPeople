import type { GameSummary } from './types';

export type OpponentRecord = {
  draws: number;
  games: GameSummary[];
  goalsAgainst: number;
  goalsFor: number;
  losses: number;
  name: string;
  opponentId: string;
  scoredGames: number;
  walkovers: number;
  wins: number;
};

export function calculateOpponentRecords(
  games: GameSummary[],
): OpponentRecord[] {
  const records = new Map<string, OpponentRecord>();

  for (const game of games) {
    const opponentId = game.opponentClub.id;
    let record = records.get(opponentId);

    if (!record) {
      record = {
        draws: 0,
        games: [],
        goalsAgainst: 0,
        goalsFor: 0,
        losses: 0,
        name: game.opponentClub.name,
        opponentId,
        scoredGames: 0,
        walkovers: 0,
        wins: 0,
      };
      records.set(opponentId, record);
    }

    record.games.push(game);

    if (game.isWalkover) {
      record.walkovers += 1;
    } else if (game.ourScore !== null && game.opponentScore !== null) {
      record.scoredGames += 1;
      record.goalsFor += game.ourScore;
      record.goalsAgainst += game.opponentScore;

      if (game.ourScore > game.opponentScore) record.wins += 1;
      else if (game.ourScore < game.opponentScore) record.losses += 1;
      else record.draws += 1;
    }
  }

  return [...records.values()]
    .map((record) => ({
      ...record,
      games: record.games.sort(
        (left, right) =>
          right.datePlayed.localeCompare(left.datePlayed) ||
          right.createdAt.localeCompare(left.createdAt),
      ),
    }))
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name, 'en-GB') ||
        left.opponentId.localeCompare(right.opponentId),
    );
}
