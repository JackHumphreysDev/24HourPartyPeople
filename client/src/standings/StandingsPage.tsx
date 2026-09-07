import { useEffect, useState } from 'react';

import { getCurrentStandings } from './api';
import type { StandingsSnapshot } from './types';

const TEAM_NAME = '24 Hour Party People';

function formatLastUpdated(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(new Date(value));
}

export function StandingsPage() {
  const [snapshot, setSnapshot] = useState<StandingsSnapshot | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );

  useEffect(() => {
    let isCurrentRequest = true;

    void getCurrentStandings()
      .then((nextSnapshot) => {
        if (isCurrentRequest) {
          setSnapshot(nextSnapshot);
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
        <p className="eyebrow">The league</p>
        <h2>Current standings</h2>
        <p>
          The current table for 24 Hour Party People’s Sheffield six-a-side
          league.
        </p>
      </div>

      {status === 'loading' && (
        <p className="status-panel">Loading current standings…</p>
      )}
      {status === 'error' && (
        <p className="status-panel status-panel-error" role="alert">
          Current standings could not be loaded.
        </p>
      )}
      {status === 'ready' && snapshot?.standings.length === 0 && (
        <p className="status-panel">
          No standings have been recorded for the current season.
        </p>
      )}

      {snapshot && snapshot.standings.length > 0 && (
        <>
          <div className="standings-meta">
            <h3>{snapshot.season?.name}</h3>
            {snapshot.lastUpdated && (
              <p>Last updated {formatLastUpdated(snapshot.lastUpdated)}</p>
            )}
          </div>
          <div className="table-scroll">
            <table className="standings-table">
              <thead>
                <tr>
                  <th scope="col">Pos</th>
                  <th scope="col">Club</th>
                  <th scope="col">P</th>
                  <th scope="col">W</th>
                  <th scope="col">D</th>
                  <th scope="col">L</th>
                  <th scope="col">GF</th>
                  <th scope="col">GA</th>
                  <th scope="col">GD</th>
                  <th scope="col">Pts</th>
                  <th scope="col">WO</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.standings.map((row) => (
                  <tr
                    className={
                      row.clubName.toLocaleLowerCase('en-GB') ===
                      TEAM_NAME.toLocaleLowerCase('en-GB')
                        ? 'team-standing-row'
                        : undefined
                    }
                    key={row.id}
                  >
                    <td>{row.position}</td>
                    <th scope="row">{row.clubName}</th>
                    <td>{row.played}</td>
                    <td>{row.won}</td>
                    <td>{row.drawn}</td>
                    <td>{row.lost}</td>
                    <td>{row.gf}</td>
                    <td>{row.ga}</td>
                    <td>{row.gd}</td>
                    <td className="standings-points">{row.points}</td>
                    <td>{row.walkoverGames}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
