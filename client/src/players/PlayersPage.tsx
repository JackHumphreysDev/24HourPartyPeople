import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getPlayerDirectory } from './api';
import { PlayerAvatar } from './PlayerAvatar';
import type { PlayerPosition, PlayerSummary } from './types';
import { positionLabels } from './types';

const positionSections: ReadonlyArray<{
  heading: string;
  position: PlayerPosition;
}> = [
  { heading: 'Keepers', position: 'GK' },
  { heading: 'Defenders', position: 'DEF' },
  { heading: 'Midfielders', position: 'MID' },
  { heading: 'Attackers', position: 'FWD' },
];

export function PlayersPage() {
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [historicalPlayers, setHistoricalPlayers] = useState<PlayerSummary[]>(
    [],
  );
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );

  useEffect(() => {
    const controller = new AbortController();

    void getPlayerDirectory()
      .then((directory) => {
        setPlayers(directory.players);
        setHistoricalPlayers(directory.historicalPlayers);
        setStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setStatus('error');
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <section className="content-section" aria-labelledby="players-heading">
      <div className="section-heading">
        <p className="eyebrow">Meet the team</p>
        <h2 id="players-heading">Current squad</h2>
        <p>The players representing 24 Hour Party People.</p>
      </div>

      {status === 'loading' && <p className="status-panel">Loading squad…</p>}
      {status === 'error' && (
        <p className="status-panel status-panel-error" role="alert">
          The squad could not be loaded. Please try again.
        </p>
      )}
      {status === 'ready' && players.length === 0 && (
        <p className="status-panel">The current squad will appear here.</p>
      )}

      {players.length > 0 && (
        <div className="player-position-sections">
          {positionSections.map((section) => {
            const sectionPlayers = players.filter(
              (player) => player.position === section.position,
            );
            return (
              <section
                className="player-position-section"
                key={section.position}
              >
                <div className="section-heading section-heading-compact">
                  <p className="eyebrow">{positionLabels[section.position]}</p>
                  <h3>{section.heading}</h3>
                </div>
                {sectionPlayers.length === 0 ? (
                  <p className="status-panel">
                    No {section.heading.toLocaleLowerCase('en-GB')} are in the
                    current squad.
                  </p>
                ) : (
                  <div className="player-grid">
                    {sectionPlayers.map((player) => (
                      <Link
                        className="player-card"
                        key={player.id}
                        to={`/players/${player.id}`}
                      >
                        <PlayerAvatar player={player} />
                        <div>
                          <p className="position-label">
                            Primary: {positionLabels[section.position]}
                            {player.isOnBench ? ' · Bench' : ''}
                          </p>
                          <h3>{player.name}</h3>
                          {(player.additionalPositions?.length ?? 0) > 0 && (
                            <p className="player-positions">
                              Also plays:{' '}
                              {player.additionalPositions
                                .map((position) => positionLabels[position])
                                .join(', ')}
                            </p>
                          )}
                          <p className="player-description">
                            {player.description}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {status === 'ready' && historicalPlayers.length > 0 && (
        <section
          className="player-position-section historical-player-section"
          aria-labelledby="historical-players-heading"
        >
          <div className="section-heading">
            <p className="eyebrow">Club archive</p>
            <h2 id="historical-players-heading">Historical players</h2>
            <p>Former players with statistics recorded in the club history.</p>
          </div>
          <div className="player-grid">
            {historicalPlayers.map((player) => (
              <Link
                className="player-card"
                key={player.id}
                to={`/players/${player.id}`}
              >
                <PlayerAvatar player={player} />
                <div>
                  <p className="position-label">
                    Historical player
                    {player.position
                      ? ` · ${positionLabels[player.position]}`
                      : ''}
                  </p>
                  <h3>{player.name}</h3>
                  <p className="player-description">{player.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
