import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getStatisticsSnapshot } from './api';
import type { LeaderboardEntry, StatisticsSnapshot } from './types';

const metrics = [
  { key: 'goals', heading: 'Goals', label: 'Top scorers' },
  { key: 'assists', heading: 'Assists', label: 'Assist leaders' },
  { key: 'cleanSheets', heading: 'Clean sheets', label: 'Clean-sheet leaders' },
] as const;

function Leaderboard({
  entries,
  heading,
  label,
}: {
  entries: LeaderboardEntry[];
  heading: string;
  label: string;
}) {
  return (
    <section className="stat-leaderboard" aria-label={label}>
      <h3>{heading}</h3>
      {entries.length === 0 ? (
        <p>No {heading.toLocaleLowerCase('en-GB')} recorded for this view.</p>
      ) : (
        <ol className="stat-leaderboard-list">
          {entries.map((entry) => (
            <li key={entry.playerId}>
              <span className="stat-leaderboard-rank">#{entry.rank}</span>
              <Link to={`/players/${entry.playerId}`}>
                {entry.name}
                {!entry.isActiveSquad && (
                  <span className="stat-leaderboard-historical">
                    {' '}
                    · Historical
                  </span>
                )}
              </Link>
              <strong>{entry.value}</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function StatisticsHubPage() {
  const [snapshot, setSnapshot] = useState<StatisticsSnapshot | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [selectedSeasonId, setSelectedSeasonId] = useState('all-time');

  useEffect(() => {
    let isCurrentRequest = true;
    void getStatisticsSnapshot()
      .then((result) => {
        if (isCurrentRequest) {
          setSnapshot(result);
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

  const selectedBoard = snapshot?.leaderboards.find(
    (board) =>
      board.seasonId ===
      (selectedSeasonId === 'all-time' ? null : selectedSeasonId),
  );

  return (
    <section className="content-section" aria-labelledby="statistics-heading">
      <div className="section-heading">
        <p className="eyebrow">The record book</p>
        <h2 id="statistics-heading">Player statistics</h2>
        <p>
          Compare recorded goals, assists and clean sheets across the club’s
          seasons. Historical games played are not estimated.
        </p>
      </div>

      {status === 'loading' && (
        <p className="status-panel">Loading player statistics…</p>
      )}
      {status === 'error' && (
        <p className="status-panel status-panel-error" role="alert">
          Player statistics could not be loaded. Please try again.
        </p>
      )}
      {status === 'ready' && snapshot && (
        <>
          <label className="statistics-season-filter">
            View statistics for
            <select
              value={selectedSeasonId}
              onChange={(event) => setSelectedSeasonId(event.target.value)}
            >
              <option value="all-time">All-time recorded totals</option>
              {snapshot.seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                  {season.isCurrent ? ' (current)' : ''}
                </option>
              ))}
            </select>
          </label>

          {selectedBoard && (
            <div className="stat-leaderboard-grid">
              {metrics.map((metric) => (
                <Leaderboard
                  entries={selectedBoard[metric.key]}
                  heading={metric.heading}
                  key={metric.key}
                  label={metric.label}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
