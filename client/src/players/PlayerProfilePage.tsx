import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getPlayer, PlayerApiError } from './api';
import { PlayerAvatar } from './PlayerAvatar';
import type { PlayerDetail } from './types';
import { positionLabels } from './types';

type StatValues = {
  assists: number;
  cleanSheets: number;
  gamesPlayed: number | null;
  goals: number;
};

function StatGrid({ stats }: { stats: StatValues }) {
  return (
    <dl className="stat-grid">
      <div>
        <dt>Goals</dt>
        <dd>{stats.goals}</dd>
      </div>
      <div>
        <dt>Assists</dt>
        <dd>{stats.assists}</dd>
      </div>
      <div>
        <dt>Clean sheets</dt>
        <dd>{stats.cleanSheets}</dd>
      </div>
      <div>
        <dt>Games played</dt>
        <dd>{stats.gamesPlayed ?? 'Not recorded'}</dd>
      </div>
    </dl>
  );
}

export function PlayerProfilePage() {
  const { playerId = '' } = useParams();
  const [result, setResult] = useState<{
    player: PlayerDetail | null;
    playerId: string;
    status: 'ready' | 'not-found' | 'error';
  } | null>(null);

  useEffect(() => {
    let isCurrentRequest = true;

    void getPlayer(playerId)
      .then((nextPlayer) => {
        if (isCurrentRequest) {
          setResult({ player: nextPlayer, playerId, status: 'ready' });
        }
      })
      .catch((error: unknown) => {
        if (isCurrentRequest) {
          setResult({
            player: null,
            playerId,
            status:
              error instanceof PlayerApiError && error.status === 404
                ? 'not-found'
                : 'error',
          });
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [playerId]);

  const status = result?.playerId === playerId ? result.status : 'loading';
  const player = result?.playerId === playerId ? result.player : null;

  const careerStats = useMemo(() => {
    if (!player) {
      return null;
    }

    const totals = player.seasonStats.reduce<StatValues>(
      (currentTotals, stats) => ({
        assists: currentTotals.assists + stats.assists,
        cleanSheets: currentTotals.cleanSheets + stats.cleanSheets,
        gamesPlayed:
          (currentTotals.gamesPlayed ?? 0) + (stats.gamesPlayed ?? 0),
        goals: currentTotals.goals + stats.goals,
      }),
      { assists: 0, cleanSheets: 0, gamesPlayed: 0, goals: 0 },
    );

    return {
      ...totals,
      gamesPlayed: player.seasonStats.some(
        (stats) => stats.gamesPlayed !== null,
      )
        ? totals.gamesPlayed
        : null,
    };
  }, [player]);

  if (status === 'loading') {
    return <p className="status-panel">Loading player profile…</p>;
  }

  if (status === 'not-found') {
    return (
      <section className="status-panel">
        <h2>Player not found</h2>
        <Link to="/players">Return to the squad</Link>
      </section>
    );
  }

  if (status === 'error' || !player || !careerStats) {
    return (
      <p className="status-panel status-panel-error" role="alert">
        This player profile could not be loaded.
      </p>
    );
  }

  const currentStats = player.seasonStats.find(
    (stats) => stats.season.isCurrent,
  );
  const previousStats = player.seasonStats.filter(
    (stats) => !stats.season.isCurrent,
  );

  return (
    <article className="profile-page">
      <Link className="back-link" to="/players">
        ← Current squad
      </Link>

      <header className="profile-header">
        <PlayerAvatar player={player} />
        <div>
          <p className="eyebrow">Primary: {positionLabels[player.position]}</p>
          <h2>{player.name}</h2>
          {(player.additionalPositions?.length ?? 0) > 0 && (
            <p className="profile-positions">
              Also plays:{' '}
              {player.additionalPositions
                .map((position) => positionLabels[position])
                .join(', ')}
            </p>
          )}
          <p>{player.description}</p>
        </div>
      </header>

      <section className="profile-section">
        <div className="section-heading section-heading-compact">
          <p className="eyebrow">This season</p>
          <h3>{currentStats?.season.name ?? 'Current season'}</h3>
        </div>
        {currentStats ? (
          <StatGrid stats={currentStats} />
        ) : (
          <p className="status-panel">No current-season statistics yet.</p>
        )}
      </section>

      <section className="profile-section">
        <div className="section-heading section-heading-compact">
          <p className="eyebrow">Overall</p>
          <h3>Recorded career totals</h3>
          <p>
            Games played only includes seasons where attendance was recorded.
          </p>
        </div>
        <StatGrid stats={careerStats} />
      </section>

      <section className="profile-section">
        <div className="section-heading section-heading-compact">
          <p className="eyebrow">History</p>
          <h3>Previous seasons</h3>
        </div>
        {previousStats.length === 0 ? (
          <p className="status-panel">No previous-season statistics yet.</p>
        ) : (
          <div className="season-history">
            {previousStats.map((stats) => (
              <article key={stats.id} className="season-card">
                <h4>{stats.season.name}</h4>
                <StatGrid stats={stats} />
                {stats.note && <p className="season-note">{stats.note}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
