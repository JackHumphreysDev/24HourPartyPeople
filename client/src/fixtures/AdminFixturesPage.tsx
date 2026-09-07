import { useEffect, useState, type FormEvent } from 'react';
import { NavLink } from 'react-router-dom';

import { AuthScreen } from '../AuthScreen';
import { useAuth } from '../auth/useAuth';
import type { Competition } from '../games/types';
import { getAdminSeasons } from '../players/api';
import type { SeasonSummary } from '../players/types';
import { createFixture, getAdminFixtures, updateFixture } from './api';
import type { FixtureInput, FixtureSummary } from './types';

type FixtureDraft = {
  competition: Competition;
  opponentName: string;
  scheduledDate: string;
  scheduledTime: string;
  seasonId: string;
  venue: string;
};

const emptyDraft: FixtureDraft = {
  competition: 'LEAGUE',
  opponentName: '',
  scheduledDate: '',
  scheduledTime: '',
  seasonId: '',
  venue: '',
};

function dateInputValue(value: string): string {
  return value.slice(0, 10);
}

function timeInputValue(value: string | null): string {
  return value ? value.slice(11, 16) : '';
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The fixture could not be saved.';
}

function statusLabel(fixture: FixtureSummary): string {
  if (fixture.status === 'WALKOVER') {
    return 'Walkover';
  }
  return fixture.status === 'PLAYED' ? 'Played' : 'Scheduled';
}

function FixtureManager() {
  const [fixtures, setFixtures] = useState<FixtureSummary[]>([]);
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [draft, setDraft] = useState<FixtureDraft>(emptyDraft);
  const [editingFixtureId, setEditingFixtureId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCurrentRequest = true;

    void Promise.all([getAdminFixtures(), getAdminSeasons()])
      .then(([nextFixtures, nextSeasons]) => {
        if (!isCurrentRequest) {
          return;
        }

        setFixtures(nextFixtures);
        setSeasons(nextSeasons);
        setDraft({
          ...emptyDraft,
          seasonId:
            nextSeasons.find((season) => season.isCurrent)?.id ??
            nextSeasons[0]?.id ??
            '',
        });
        setLoadStatus('ready');
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

  const selectedSeason = seasons.find((season) => season.id === draft.seasonId);
  const editingFixture = fixtures.find(
    (fixture) => fixture.id === editingFixtureId,
  );

  function resetForm() {
    setEditingFixtureId(null);
    setDraft({
      ...emptyDraft,
      seasonId:
        seasons.find((season) => season.isCurrent)?.id ?? seasons[0]?.id ?? '',
    });
    setError(null);
  }

  function editFixture(fixture: FixtureSummary) {
    setEditingFixtureId(fixture.id);
    setDraft({
      competition: fixture.competition,
      opponentName: fixture.opponentClub.name,
      scheduledDate: dateInputValue(fixture.scheduledDate),
      scheduledTime: timeInputValue(fixture.scheduledTime),
      seasonId: fixture.season.id,
      venue: fixture.venue ?? '',
    });
    setError(null);
    setSuccessMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.seasonId) {
      return;
    }

    const input: FixtureInput = {
      competition: draft.competition,
      opponentName: draft.opponentName,
      scheduledDate: draft.scheduledDate,
      scheduledTime: draft.scheduledTime || null,
      seasonId: draft.seasonId,
      venue: draft.venue.trim() || null,
    };

    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (editingFixtureId) {
        await updateFixture(editingFixtureId, input);
      } else {
        await createFixture(input);
      }
      const nextFixtures = await getAdminFixtures();
      setFixtures(nextFixtures);
      setSuccessMessage(
        editingFixtureId
          ? 'Fixture updated successfully.'
          : 'Fixture created successfully.',
      );
      resetForm();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="admin-layout fixture-admin-layout">
      <div className="admin-player-list">
        <div className="section-heading section-heading-compact">
          <p className="eyebrow">Administrator</p>
          <h2>Manage fixtures</h2>
          <p>
            Add scheduled games manually or correct them before a result is
            recorded.
          </p>
        </div>

        {loadStatus === 'loading' && (
          <p className="status-panel">Loading fixtures…</p>
        )}
        {loadStatus === 'error' && (
          <p className="status-panel status-panel-error" role="alert">
            Fixtures and seasons could not be loaded.
          </p>
        )}
        {loadStatus === 'ready' && fixtures.length === 0 && (
          <p className="status-panel">No fixtures have been recorded.</p>
        )}

        <div className="admin-player-items">
          {fixtures.map((fixture) => {
            const canEdit =
              fixture.status === 'SCHEDULED' && fixture.result === null;
            return (
              <article className="admin-player-item" key={fixture.id}>
                <div>
                  <p className="position-label">
                    {statusLabel(fixture)} ·{' '}
                    {fixture.source === 'MANUAL' ? 'Manual' : 'Scraped'} ·{' '}
                    {fixture.competition === 'LEAGUE' ? 'League' : 'Cup'}
                  </p>
                  <h3>{fixture.opponentClub.name}</h3>
                  <p className="admin-item-detail">
                    {dateInputValue(fixture.scheduledDate)}
                    {fixture.scheduledTime
                      ? ` at ${timeInputValue(fixture.scheduledTime)}`
                      : ' · Kick-off TBC'}{' '}
                    · {fixture.season.name}
                    {fixture.venue ? ` · ${fixture.venue}` : ''}
                  </p>
                </div>
                {canEdit ? (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => editFixture(fixture)}
                  >
                    Edit
                  </button>
                ) : (
                  <span className="fixture-read-only">Recorded</span>
                )}
              </article>
            );
          })}
        </div>
      </div>

      <form className="admin-player-form" onSubmit={handleSubmit}>
        <div className="admin-form-heading">
          <div>
            <p className="eyebrow">
              {editingFixture ? 'Update fixture' : 'New fixture'}
            </p>
            <h3>{editingFixture?.opponentClub.name ?? 'Add a fixture'}</h3>
          </div>
          {editingFixture && (
            <button className="text-button" type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>

        {seasons.length === 0 ? (
          <p className="status-panel">
            Create a season before adding a fixture.
          </p>
        ) : (
          <>
            <label>
              Season
              <select
                required
                value={draft.seasonId}
                onChange={(event) =>
                  setDraft({ ...draft, seasonId: event.target.value })
                }
              >
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                    {season.isCurrent ? ' (current)' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Opponent
              <input
                maxLength={100}
                required
                value={draft.opponentName}
                onChange={(event) =>
                  setDraft({ ...draft, opponentName: event.target.value })
                }
              />
            </label>

            <label>
              Date
              <input
                max={selectedSeason && dateInputValue(selectedSeason.endDate)}
                min={selectedSeason && dateInputValue(selectedSeason.startDate)}
                required
                type="date"
                value={draft.scheduledDate}
                onChange={(event) =>
                  setDraft({ ...draft, scheduledDate: event.target.value })
                }
              />
            </label>

            <label>
              Kick-off time (optional)
              <input
                type="time"
                value={draft.scheduledTime}
                onChange={(event) =>
                  setDraft({ ...draft, scheduledTime: event.target.value })
                }
              />
              <span className="field-hint">Sheffield local time.</span>
            </label>

            <label>
              Competition
              <select
                value={draft.competition}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    competition: event.target.value as Competition,
                  })
                }
              >
                <option value="LEAGUE">League</option>
                <option value="CUP">Cup</option>
              </select>
            </label>

            <label>
              Venue (optional)
              <input
                maxLength={200}
                value={draft.venue}
                onChange={(event) =>
                  setDraft({ ...draft, venue: event.target.value })
                }
              />
            </label>

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

            <button
              className="primary-button"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting
                ? 'Saving…'
                : editingFixture
                  ? 'Save fixture'
                  : 'Create fixture'}
            </button>
          </>
        )}
      </form>
    </section>
  );
}

export function AdminFixturesPage() {
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
        <NavLink to="/admin/fixtures">Fixtures</NavLink>
        <NavLink to="/admin/games">Results</NavLink>
      </nav>
      <FixtureManager />
    </>
  );
}
