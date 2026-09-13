import type { Competition, GameSummary } from './types';

export type FormOutcome = 'W' | 'D' | 'L';

export type ScoredGame = GameSummary & {
  opponentScore: number;
  ourScore: number;
};

export type GoalDifferencePoint = {
  game: ScoredGame;
  runningGoalDifference: number;
};

export type SeasonForm = {
  draws: number;
  form: Array<{ game: ScoredGame; outcome: FormOutcome }>;
  goalDifference: number;
  goalsAgainst: number;
  goalsFor: number;
  losses: number;
  scoredGames: number;
  trend: GoalDifferencePoint[];
  walkovers: number;
  wins: number;
};

function hasScore(game: GameSummary): game is ScoredGame {
  return (
    !game.isWalkover && game.ourScore !== null && game.opponentScore !== null
  );
}

function gameOutcome(game: ScoredGame): FormOutcome {
  if (game.ourScore > game.opponentScore) return 'W';
  if (game.ourScore < game.opponentScore) return 'L';
  return 'D';
}

export function calculateSeasonForm(
  games: GameSummary[],
  seasonId: string,
  competition: Competition | 'ALL',
): SeasonForm {
  const selectedGames = games
    .filter(
      (game) =>
        game.season.id === seasonId &&
        (competition === 'ALL' || game.competition === competition),
    )
    .sort(
      (left, right) =>
        right.datePlayed.localeCompare(left.datePlayed) ||
        right.createdAt.localeCompare(left.createdAt),
    );
  const scored = selectedGames.filter(hasScore);
  const outcomes = scored.map(gameOutcome);
  const wins = outcomes.filter((outcome) => outcome === 'W').length;
  const draws = outcomes.filter((outcome) => outcome === 'D').length;
  const losses = outcomes.filter((outcome) => outcome === 'L').length;
  const goalsFor = scored.reduce((sum, game) => sum + game.ourScore, 0);
  const goalsAgainst = scored.reduce(
    (sum, game) => sum + game.opponentScore,
    0,
  );
  let runningGoalDifference = 0;
  const trend = [...scored].reverse().map((game) => {
    runningGoalDifference += game.ourScore - game.opponentScore;
    return { game, runningGoalDifference };
  });

  return {
    draws,
    form: scored
      .slice(0, 5)
      .reverse()
      .map((game) => ({ game, outcome: gameOutcome(game) })),
    goalDifference: goalsFor - goalsAgainst,
    goalsAgainst,
    goalsFor,
    losses,
    scoredGames: scored.length,
    trend,
    walkovers: selectedGames.filter((game) => game.isWalkover).length,
    wins,
  };
}
