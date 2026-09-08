import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

import { AuthScreen } from '../AuthScreen';
import { useAuth } from '../auth/useAuth';
import { finaliseClubHistory, getAdminClubHistory } from './api';
import type { ClubHistoryCandidate, ClubHistoryEntry } from './types';

function shortDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeZone: 'Europe/London',
  }).format(new Date(value));
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The season could not be finalised.';
}

function ClubHistoryManager() {
  const [candidates, setCandidates] = useState<ClubHistoryCandidate[]>([]);
  const [history, setHistory] = useState<ClubHistoryEntry[]>([]);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [finalisingId, setFinalisingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCurrentRequest = true;

    void getAdminClubHistory()
      .then((result) => {
        if (isCurrentRequest) {
          setCandidates(result.candidates);
          setHistory(result.history);
          setLoadStatus('ready');
        }
      })
      .catch(() => {
        if (isCurrentRequest) {
          setLoadStatus('error');
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, []);

  async function finalise(candidate: ClubHistoryCandidate) {
    setFinalisingId(candidate.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const entry = await finaliseClubHistory(candidate.id);
      setCandidates((current) =>
        current.filter((season) => season.id !== candidate.id),
      );
      setHistory((current) =>
        [...current, entry].sort(
          (left, right) =>
            new Date(right.season.endDate).getTime() -
            new Date(left.season.endDate).getTime(),
        ),
      );
      setSuccessMessage(`${candidate.name} was added to club history.`);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setFinalisingId(null);
    }
  }

  return (
    <section className="club-history-admin-page">
      <div className="section-heading">
        <p className="eyebrow">Administrator</p>
        <h2>Finalise club history</h2>
        <p>
          Copy an ended season’s saved team standings into the permanent club
          record. Finalised finishes cannot be edited through the website.
        </p>
      </div>

      {loadStatus === 'loading' && (
        <p className="status-panel">Loading eligible seasons…</p>
      )}
      {loadStatus === 'error' && (
        <p className="status-panel status-panel-error" role="alert">
          Club history could not be loaded.
        </p>
      )}

      {loadStatus === 'ready' && (
        <>
          {successMessage && (
            <p className="form-success" role="status">
              {successMessage}
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="history-finalisation-list">
            {candidates.length === 0 && (
              <p className="status-panel">
                No ended seasons are waiting to be finalised.
              </p>
            )}
            {candidates.map((candidate) => (
              <article className="history-finalisation-card" key={candidate.id}>
                <div>
                  <p className="position-label">
                    Ended {shortDate(candidate.endDate)}
                  </p>
                  <h3>{candidate.name}</h3>
                  {candidate.standing ? (
                    <p className="admin-item-detail">
                      Position {candidate.standing.position} ·{' '}
                      {candidate.standing.points} points ·{' '}
                      {candidate.standing.played} played
                    </p>
                  ) : (
                    <p className="admin-item-detail">
                      The team standings row has not been saved.
                    </p>
                  )}
                </div>
                <button
                  className="primary-button"
                  disabled={!candidate.standing || finalisingId !== null}
                  type="button"
                  onClick={() => void finalise(candidate)}
                >
                  {finalisingId === candidate.id ? 'Finalising…' : 'Finalise'}
                </button>
              </article>
            ))}
          </div>

          <div className="history-finalised-section">
            <div className="section-heading section-heading-compact">
              <p className="eyebrow">Permanent record</p>
              <h3>Finalised seasons</h3>
            </div>
            {history.length === 0 ? (
              <p className="status-panel">No seasons have been finalised.</p>
            ) : (
              <div className="table-scroll">
                <table className="standings-table">
                  <thead>
                    <tr>
                      <th scope="col">Season</th>
                      <th scope="col">Pos</th>
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
                      <tr key={entry.id}>
                        <th scope="row">{entry.season.name}</th>
                        <td>{entry.position}</td>
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
          </div>
        </>
      )}
    </section>
  );
}

export function AdminClubHistoryPage() {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return <p className="status-panel">Checking your session…</p>;
  }
  if (status === 'anonymous') {
    return <AuthScreen />;
  }
  if (user?.role !== 'ADMIN') {
    return (
      <p className="status-panel status-panel-error">
        Administrator access is required.
      </p>
    );
  }

  return (
    <>
      <nav className="admin-nav" aria-label="Administrator sections">
        <NavLink to="/admin" end>
          Players
        </NavLink>
        <NavLink to="/admin/statistics">Seasons &amp; statistics</NavLink>
        <NavLink to="/admin/standings">Standings</NavLink>
        <NavLink to="/admin/fixtures">Fixtures</NavLink>
        <NavLink to="/admin/games">Results</NavLink>
        <NavLink to="/admin/club-history">Club history</NavLink>
      </nav>
      <ClubHistoryManager />
    </>
  );
}
