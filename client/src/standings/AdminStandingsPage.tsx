import { useEffect, useState, type FormEvent } from 'react';
import { NavLink } from 'react-router-dom';

import { AuthScreen } from '../AuthScreen';
import { useAuth } from '../auth/useAuth';
import { getAdminStandings, replaceCurrentStandings } from './api';
import type { StandingRowInput, StandingsSnapshot } from './types';

const TEAM_NAME = '24 Hour Party People';

type StandingDraft = Record<
  Exclude<keyof StandingRowInput, 'clubName'>,
  string
> & {
  clubName: string;
};

const numberFields = [
  'position',
  'played',
  'won',
  'drawn',
  'lost',
  'gf',
  'ga',
  'points',
  'walkoverGames',
] as const;

function emptyRow(position: number, clubName = ''): StandingDraft {
  return {
    clubName,
    drawn: '0',
    ga: '0',
    gf: '0',
    lost: '0',
    played: '0',
    points: '0',
    position: String(position),
    walkoverGames: '0',
    won: '0',
  };
}

function snapshotDraft(snapshot: StandingsSnapshot): StandingDraft[] {
  if (snapshot.standings.length === 0) {
    return [emptyRow(1, TEAM_NAME)];
  }

  return snapshot.standings.map((row) => ({
    clubName: row.clubName,
    drawn: String(row.drawn),
    ga: String(row.ga),
    gf: String(row.gf),
    lost: String(row.lost),
    played: String(row.played),
    points: String(row.points),
    position: String(row.position),
    walkoverGames: String(row.walkoverGames),
    won: String(row.won),
  }));
}

function formatLastUpdated(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(new Date(value));
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The standings could not be saved.';
}

function StandingsManager() {
  const [snapshot, setSnapshot] = useState<StandingsSnapshot | null>(null);
  const [rows, setRows] = useState<StandingDraft[]>([]);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCurrentRequest = true;

    void getAdminStandings()
      .then((nextSnapshot) => {
        if (isCurrentRequest) {
          setSnapshot(nextSnapshot);
          setRows(snapshotDraft(nextSnapshot));
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

  function updateRow(index: number, field: keyof StandingDraft, value: string) {
    setRows((currentRows) =>
      currentRows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    );
    setError(null);
    setSuccessMessage(null);
  }

  function removeRow(index: number) {
    setRows((currentRows) =>
      currentRows.filter((_row, rowIndex) => rowIndex !== index),
    );
    setError(null);
    setSuccessMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const inputRows: StandingRowInput[] = rows.map((row) => ({
      clubName: row.clubName,
      drawn: Number(row.drawn),
      ga: Number(row.ga),
      gf: Number(row.gf),
      lost: Number(row.lost),
      played: Number(row.played),
      points: Number(row.points),
      position: Number(row.position),
      walkoverGames: Number(row.walkoverGames),
      won: Number(row.won),
    }));

    try {
      const nextSnapshot = await replaceCurrentStandings(inputRows);
      setSnapshot(nextSnapshot);
      setRows(snapshotDraft(nextSnapshot));
      setSuccessMessage('Current standings updated successfully.');
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loadStatus === 'loading') {
    return <p className="status-panel">Loading current standings…</p>;
  }

  if (loadStatus === 'error') {
    return (
      <p className="status-panel status-panel-error" role="alert">
        Current standings could not be loaded.
      </p>
    );
  }

  if (!snapshot?.season) {
    return (
      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">Administrator</p>
          <h2>Manage standings</h2>
        </div>
        <p className="status-panel">
          Create a current season before entering league standings.
        </p>
      </section>
    );
  }

  return (
    <section className="standings-admin-page">
      <div className="section-heading">
        <p className="eyebrow">Administrator · {snapshot.season.name}</p>
        <h2>Manage standings</h2>
        <p>
          Enter the complete current table. Saving replaces the previous
          snapshot in one transaction and calculates goal difference.
        </p>
        {snapshot.lastUpdated && (
          <p className="standings-last-updated">
            Last updated {formatLastUpdated(snapshot.lastUpdated)}
          </p>
        )}
      </div>

      <form className="standings-editor" onSubmit={handleSubmit}>
        <div className="table-scroll">
          <table className="standings-table standings-input-table">
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
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const rowLabel = row.clubName || `Row ${index + 1}`;
                const isOurTeam =
                  row.clubName.toLocaleLowerCase('en-GB') ===
                  TEAM_NAME.toLocaleLowerCase('en-GB');
                return (
                  <tr
                    className={isOurTeam ? 'team-standing-row' : undefined}
                    key={index}
                  >
                    {numberFields.slice(0, 1).map((field) => (
                      <td key={field}>
                        <input
                          aria-label={`${rowLabel} position`}
                          min={1}
                          required
                          step={1}
                          type="number"
                          value={row[field]}
                          onChange={(event) =>
                            updateRow(index, field, event.target.value)
                          }
                        />
                      </td>
                    ))}
                    <th scope="row">
                      <input
                        aria-label={`${rowLabel} club name`}
                        maxLength={100}
                        required
                        value={row.clubName}
                        onChange={(event) =>
                          updateRow(index, 'clubName', event.target.value)
                        }
                      />
                    </th>
                    {numberFields.slice(1, 7).map((field) => (
                      <td key={field}>
                        <input
                          aria-label={`${rowLabel} ${field}`}
                          min={0}
                          required
                          step={1}
                          type="number"
                          value={row[field]}
                          onChange={(event) =>
                            updateRow(index, field, event.target.value)
                          }
                        />
                      </td>
                    ))}
                    <td className="calculated-cell">
                      {Number(row.gf) - Number(row.ga)}
                    </td>
                    {numberFields.slice(7).map((field) => (
                      <td key={field}>
                        <input
                          aria-label={`${rowLabel} ${field}`}
                          min={0}
                          required
                          step={1}
                          type="number"
                          value={row[field]}
                          onChange={(event) =>
                            updateRow(index, field, event.target.value)
                          }
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        className="text-button"
                        disabled={isOurTeam}
                        type="button"
                        onClick={() => removeRow(index)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="field-hint">
          P must equal W + D + L. Walkovers cannot exceed games played. Goal
          difference is calculated from GF and GA.
        </p>

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

        <div className="standings-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => setRows([...rows, emptyRow(rows.length + 1)])}
          >
            Add club
          </button>
          <button
            className="primary-button"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Saving…' : 'Save complete table'}
          </button>
        </div>
      </form>
    </section>
  );
}

export function AdminStandingsPage() {
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
        <NavLink to="/admin/home-page">Home page</NavLink>
        <NavLink to="/admin" end>
          Players
        </NavLink>
        <NavLink to="/admin/statistics">Seasons &amp; statistics</NavLink>
        <NavLink to="/admin/standings">Standings</NavLink>
        <NavLink to="/admin/fixtures">Fixtures</NavLink>
        <NavLink to="/admin/games">Results</NavLink>
        <NavLink to="/admin/club-history">Club history</NavLink>
      </nav>
      <StandingsManager />
    </>
  );
}
