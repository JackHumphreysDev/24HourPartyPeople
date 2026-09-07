import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getPlayers } from './api';
import { PlayerAvatar } from './PlayerAvatar';
import type { PlayerSummary } from './types';
import { positionLabels } from './types';

export function PlayersPage() {
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );

  useEffect(() => {
    const controller = new AbortController();

    void getPlayers()
      .then((nextPlayers) => {
        setPlayers(nextPlayers);
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
        <div className="player-grid">
          {players.map((player) => (
            <Link
              className="player-card"
              key={player.id}
              to={`/players/${player.id}`}
            >
              <PlayerAvatar player={player} />
              <div>
                <p className="position-label">
                  {positionLabels[player.position]}
                </p>
                <h3>{player.name}</h3>
                <p className="player-description">{player.description}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
