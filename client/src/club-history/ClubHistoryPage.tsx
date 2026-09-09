import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { PlayerAvatar } from '../players/PlayerAvatar';
import { getClubHistory } from './api';
import type { ClubHistoryEntry, SeasonAward, SeasonSquadEntry } from './types';

const formationLines: ReadonlyArray<{
  label: string;
  position: SeasonSquadEntry['position'];
}> = [
  { label: 'Attacker', position: 'FWD' },
  { label: 'Midfield', position: 'MID' },
  { label: 'Defence', position: 'DEF' },
  { label: 'Goalkeeper', position: 'GK' },
];

function ordinal(value: number): string {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

function AwardCard({
  award,
  label,
  suffix,
}: {
  award: SeasonAward;
  label: string;
  suffix: string;
}) {
  return (
    <article className="season-award-card">
      <p className="eyebrow">{label}</p>
      {award.players.length === 0 ? (
        <strong>Not awarded</strong>
      ) : (
        <>
          <strong>
            {award.players.map((player, index) => (
              <span key={player.id}>
                {index > 0 && ' & '}
                <Link to={`/players/${player.id}`}>{player.name}</Link>
              </span>
            ))}
          </strong>
          <span>
            {award.value} {suffix}
          </span>
        </>
      )}
    </article>
  );
}

function SeasonFormation({ squad }: { squad: SeasonSquadEntry[] }) {
  const starters = squad.filter((entry) => entry.isStarter);
  const bench = squad.filter((entry) => !entry.isStarter);
  return (
    <div>
      <div className="formation-pitch season-history-pitch">
        {formationLines.map((line) => (
          <div className="formation-line" key={line.position}>
            <span className="formation-line-label">{line.label}</span>
            <div className="formation-player-row">
              {starters
                .filter((entry) => entry.position === line.position)
                .map((entry) => (
                  <Link
                    className="formation-player"
                    key={entry.id ?? entry.playerId}
                    to={`/players/${entry.playerId}`}
                  >
                    <PlayerAvatar player={entry.player} />
                    <strong>{entry.player.name}</strong>
                  </Link>
                ))}
            </div>
          </div>
        ))}
      </div>
      {bench.length > 0 && (
        <div className="season-history-bench">
          <p className="eyebrow">Bench</p>
          <div className="formation-bench-players">
            {bench.map((entry) => (
              <Link
                className="formation-player formation-bench-player"
                key={entry.id ?? entry.playerId}
                to={`/players/${entry.playerId}`}
              >
                <PlayerAvatar player={entry.player} />
                <strong>{entry.player.name}</strong>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SeasonHistoryCard({ entry }: { entry: ClubHistoryEntry }) {
  return (
    <article className="season-history-record">
      <header className="season-history-header">
        <div>
          <p className="eyebrow">Finalised season</p>
          <h3>{entry.season.name}</h3>
        </div>
        <div className="season-position">
          <span>League finish</span>
          <strong>{ordinal(entry.position)}</strong>
        </div>
      </header>

      <div className="season-awards">
        <AwardCard
          award={entry.awards.goldenBoot}
          label="Golden Boot"
          suffix="goals"
        />
        <AwardCard
          award={entry.awards.assistKing}
          label="Assist King"
          suffix="assists"
        />
        <AwardCard
          award={entry.awards.goldenGlove}
          label="Golden Glove"
          suffix="clean sheets"
        />
      </div>

      <div className="season-history-grid">
        <SeasonFormation squad={entry.squad} />
        <dl className="season-record-stats">
          <div>
            <dt>Played</dt>
            <dd>{entry.played}</dd>
          </div>
          <div>
            <dt>Won</dt>
            <dd>{entry.won}</dd>
          </div>
          <div>
            <dt>Drawn</dt>
            <dd>{entry.drawn}</dd>
          </div>
          <div>
            <dt>Lost</dt>
            <dd>{entry.lost}</dd>
          </div>
          <div>
            <dt>Goals for</dt>
            <dd>{entry.gf}</dd>
          </div>
          <div>
            <dt>Goals against</dt>
            <dd>{entry.ga}</dd>
          </div>
          <div>
            <dt>Goal difference</dt>
            <dd>{entry.gd}</dd>
          </div>
          <div>
            <dt>Points</dt>
            <dd>{entry.points}</dd>
          </div>
          <div>
            <dt>Walkovers</dt>
            <dd>{entry.walkoverGames}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

export function ClubHistoryPage() {
  const [history, setHistory] = useState<ClubHistoryEntry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );

  useEffect(() => {
    let isCurrentRequest = true;
    void getClubHistory()
      .then((entries) => {
        if (isCurrentRequest) {
          setHistory(entries);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (isCurrentRequest) setStatus('error');
      });
    return () => {
      isCurrentRequest = false;
    };
  }, []);

  return (
    <section className="content-section">
      <div className="section-heading">
        <p className="eyebrow">The record</p>
        <h2>Club history</h2>
        <p>
          Final league finishes, representative squads and season awards from
          Summer 2026 onwards.
        </p>
      </div>

      {status === 'loading' && (
        <p className="status-panel">Loading club history…</p>
      )}
      {status === 'error' && (
        <p className="status-panel status-panel-error" role="alert">
          Club history could not be loaded.
        </p>
      )}
      {status === 'ready' && history.length === 0 && (
        <p className="status-panel">
          The first season record will appear after Summer 2026 is finalised.
        </p>
      )}
      {history.length > 0 && (
        <div className="season-history-records">
          {history.map((entry) => (
            <SeasonHistoryCard entry={entry} key={entry.id} />
          ))}
        </div>
      )}
    </section>
  );
}
