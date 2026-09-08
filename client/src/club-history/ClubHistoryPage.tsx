import { useEffect, useState } from 'react';

import { getClubHistory } from './api';
import type { ClubHistoryEntry } from './types';

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
        <p className="eyebrow">The record</p>
        <h2>Club history</h2>
        <p>
          Every finalised 24 Hour Party People league finish, recorded from the
          launch season onward.
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
          No seasons have been finalised yet. The first finish will appear after
          the current season ends.
        </p>
      )}

      {history.length > 0 && (
        <div className="table-scroll">
          <table className="standings-table">
            <thead>
              <tr>
                <th scope="col">Season</th>
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
              {history.map((entry) => (
                <tr className="team-standing-row" key={entry.id}>
                  <th scope="row">{entry.season.name}</th>
                  <td>{entry.position}</td>
                  <td>{entry.clubName}</td>
                  <td>{entry.played}</td>
                  <td>{entry.won}</td>
                  <td>{entry.drawn}</td>
                  <td>{entry.lost}</td>
                  <td>{entry.gf}</td>
                  <td>{entry.ga}</td>
                  <td>{entry.gd}</td>
                  <td className="standings-points">{entry.points}</td>
                  <td>{entry.walkoverGames}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
