import { calculateOpponentRecords } from './headToHead';
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

export function OpponentRecordsPanel({ games }: { games: GameSummary[] }) {
  const records = calculateOpponentRecords(games);

  return (
    <section
      className="opponent-records-section"
      aria-labelledby="opponent-records-heading"
    >
      <div className="section-heading">
        <p className="eyebrow">Across every season</p>
        <h3 id="opponent-records-heading">Opponent records</h3>
        <p>
          Head-to-head results across league and cup games. Walkovers have no
          recorded score or outcome and are shown separately.
        </p>
      </div>

      <div className="opponent-records-grid">
        {records.map((record) => (
          <article className="opponent-record" key={record.opponentId}>
            <h4>{record.name}</h4>
            <p className="opponent-record-summary">
              {record.scoredGames}{' '}
              {record.scoredGames === 1 ? 'scored game' : 'scored games'}
              {record.walkovers > 0 &&
                ` · ${record.walkovers} ${record.walkovers === 1 ? 'walkover' : 'walkovers'}`}
            </p>
            <dl className="opponent-record-stats">
              <div>
                <dt>W</dt>
                <dd>{record.wins}</dd>
              </div>
              <div>
                <dt>D</dt>
                <dd>{record.draws}</dd>
              </div>
              <div>
                <dt>L</dt>
                <dd>{record.losses}</dd>
              </div>
              <div>
                <dt>GF</dt>
                <dd>{record.goalsFor}</dd>
              </div>
              <div>
                <dt>GA</dt>
                <dd>{record.goalsAgainst}</dd>
              </div>
              <div>
                <dt>GD</dt>
                <dd>{signed(record.goalsFor - record.goalsAgainst)}</dd>
              </div>
            </dl>
            <details>
              <summary>View matches against {record.name}</summary>
              <ul className="opponent-record-matches">
                {record.games.map((game) => (
                  <li key={game.id}>
                    <span>
                      {formatDate(game.datePlayed)} · {game.season.name} ·{' '}
                      {game.competition === 'LEAGUE' ? 'League' : 'Cup'}
                    </span>
                    <strong>
                      {game.isWalkover
                        ? 'Walkover'
                        : game.ourScore !== null && game.opponentScore !== null
                          ? `${game.ourScore}–${game.opponentScore}`
                          : 'Score not recorded'}
                    </strong>
                  </li>
                ))}
              </ul>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
