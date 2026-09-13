import { useState } from 'react';

import { calculateSeasonForm } from './form';
import type { GameSummary } from './types';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function SeasonFormPanel({ games }: { games: GameSummary[] }) {
  const [selectedSeasonId, setSelectedSeasonId] = useState(
    games[0]?.season.id ?? '',
  );
  const [competition, setCompetition] = useState<'ALL' | 'LEAGUE' | 'CUP'>(
    'ALL',
  );
  const seasons = Array.from(
    new Map(games.map((game) => [game.season.id, game.season.name])),
  );
  const form = calculateSeasonForm(games, selectedSeasonId, competition);
  const maxGoalDifference = Math.max(
    1,
    ...form.trend.map((point) => Math.abs(point.runningGoalDifference)),
  );
  const chartPoints = [
    { x: 52, y: 80 },
    ...form.trend.map((point, index) => ({
      x: 52 + ((index + 1) / form.trend.length) * 528,
      y: 80 - (point.runningGoalDifference / maxGoalDifference) * 60,
    })),
  ];

  return (
    <section
      className="season-form-section"
      aria-labelledby="season-form-heading"
    >
      <div className="section-heading">
        <p className="eyebrow">The campaign so far</p>
        <h3 id="season-form-heading">Season form &amp; trends</h3>
        <p>
          Based on recorded scorelines. Walkovers have no recorded score, so
          they are shown separately and not counted in form or goal totals.
        </p>
      </div>

      <div className="season-form-filters">
        <label>
          Season
          <select
            value={selectedSeasonId}
            onChange={(event) => setSelectedSeasonId(event.target.value)}
          >
            {seasons.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Competition
          <select
            value={competition}
            onChange={(event) =>
              setCompetition(event.target.value as typeof competition)
            }
          >
            <option value="ALL">League and cup</option>
            <option value="LEAGUE">League only</option>
            <option value="CUP">Cup only</option>
          </select>
        </label>
      </div>

      {form.scoredGames === 0 ? (
        <p className="status-panel">
          No scored games are recorded for this season and competition.
        </p>
      ) : (
        <>
          <div className="season-form-summary">
            <div>
              <p className="eyebrow">Last five scored games</p>
              <ol
                className="season-form-list"
                aria-label="Recent form, oldest to newest"
              >
                {form.form.map(({ game, outcome }) => (
                  <li key={game.id}>
                    <span
                      className={`season-form-outcome season-form-outcome-${outcome.toLowerCase()}`}
                      aria-label={`${outcome === 'W' ? 'Win' : outcome === 'D' ? 'Draw' : 'Loss'} against ${game.opponentClub.name} on ${formatDate(game.datePlayed)}`}
                    >
                      {outcome}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <dl className="season-form-stats">
              <div>
                <dt>Scored games</dt>
                <dd>{form.scoredGames}</dd>
              </div>
              <div>
                <dt>Wins</dt>
                <dd>{form.wins}</dd>
              </div>
              <div>
                <dt>Draws</dt>
                <dd>{form.draws}</dd>
              </div>
              <div>
                <dt>Losses</dt>
                <dd>{form.losses}</dd>
              </div>
              <div>
                <dt>Goals for</dt>
                <dd>{form.goalsFor}</dd>
              </div>
              <div>
                <dt>Goals against</dt>
                <dd>{form.goalsAgainst}</dd>
              </div>
              <div>
                <dt>Goal difference</dt>
                <dd>{signed(form.goalDifference)}</dd>
              </div>
            </dl>
          </div>

          <div className="season-trend">
            <h4>Running goal difference</h4>
            <p>After each scored game in this season and competition.</p>
            <figure>
              <svg
                viewBox="0 0 600 160"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <text x="8" y="24">
                  +{maxGoalDifference}
                </text>
                <text x="8" y="84">
                  0
                </text>
                <text x="8" y="144">
                  −{maxGoalDifference}
                </text>
                <line x1="52" x2="580" y1="80" y2="80" />
                <polyline
                  points={chartPoints
                    .map((point) => `${point.x},${point.y}`)
                    .join(' ')}
                />
                {chartPoints.slice(1).map((point, index) => (
                  <circle
                    key={form.trend[index]?.game.id}
                    cx={point.x}
                    cy={point.y}
                    r="4"
                  />
                ))}
              </svg>
              <figcaption>
                Goal difference after {form.scoredGames} scored{' '}
                {form.scoredGames === 1 ? 'game' : 'games'}:{' '}
                {signed(form.goalDifference)}.
              </figcaption>
            </figure>
            <details>
              <summary>View match-by-match goal difference</summary>
              <div
                className="table-scroll"
                role="region"
                aria-label="Match-by-match goal difference"
                tabIndex={0}
              >
                <table className="season-trend-table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Opponent</th>
                      <th scope="col">Competition</th>
                      <th scope="col">Score</th>
                      <th scope="col">Running GD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.trend.map(({ game, runningGoalDifference }) => (
                      <tr key={game.id}>
                        <td>{formatDate(game.datePlayed)}</td>
                        <th scope="row">{game.opponentClub.name}</th>
                        <td>
                          {game.competition === 'LEAGUE' ? 'League' : 'Cup'}
                        </td>
                        <td>
                          {game.ourScore}–{game.opponentScore}
                        </td>
                        <td>{signed(runningGoalDifference)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </>
      )}

      {form.walkovers > 0 && (
        <p className="season-form-walkovers">
          Walkovers in this view: {form.walkovers} (not counted in form or goal
          totals).
        </p>
      )}
    </section>
  );
}
