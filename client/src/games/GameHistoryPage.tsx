import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

import { getGames } from './api';
import type { GameSummary } from './types';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(value));
}

export function GameHistoryPage() {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );

  useEffect(() => {
    let isCurrentRequest = true;

    void getGames()
      .then((nextGames) => {
        if (isCurrentRequest) {
          setGames(nextGames);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (isCurrentRequest) {
          setStatus('error');
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, []);

  return (
    <section className="content-section">
      <div className="section-heading">
        <p className="eyebrow">Every competition</p>
        <h2>Game history</h2>
        <p>
          League and cup results are recorded separately, including games played
          on the same night after a walkover.
        </p>
      </div>

      {status === 'loading' && (
        <p className="status-panel">Loading game history…</p>
      )}
      {status === 'error' && (
        <p className="status-panel status-panel-error" role="alert">
          Game history could not be loaded.
        </p>
      )}
      {status === 'ready' && games.length === 0 && (
        <p className="status-panel">No game results have been recorded.</p>
      )}

      <div className="game-history">
        {games.map((game) => (
          <article className="game-card" key={game.id}>
            <div className="game-card-meta">
              <span className="competition-label">
                {game.competition === 'LEAGUE' ? 'League' : 'Cup'}
              </span>
              <span>{formatDate(game.datePlayed)}</span>
              <span>{game.season.name}</span>
            </div>
            <div className="game-card-result">
              <div>
                <p className="eyebrow">Opponent</p>
                <h3>{game.opponentClub.name}</h3>
              </div>
              <p className={game.isWalkover ? 'walkover-result' : 'score'}>
                {game.isWalkover
                  ? 'Walkover'
                  : `${game.ourScore}–${game.opponentScore}`}
              </p>
            </div>
            {game.walkoverReason && (
              <p className="game-note">{game.walkoverReason}</p>
            )}
          </article>
        ))}
      </div>

      <NavLink className="back-link game-admin-link" to="/admin/games">
        Record a result
      </NavLink>
    </section>
  );
}
