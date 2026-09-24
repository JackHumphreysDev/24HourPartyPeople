import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { canUsePlayerProfile } from '../auth/permissions';
import {
  getOwnFixtureAvailability,
  getUpcomingFixtures,
  getUpcomingFixtureSquads,
  setFixtureAvailability,
} from './api';
import { downloadFixtureCalendarEvent } from './calendar';
import type { ScrapeStatus } from '../scrape/types';
import type {
  AvailabilityResponse,
  FixtureSummary,
  FixtureSquad,
  OwnFixtureAvailability,
} from './types';

const squadLines = [
  { label: 'Attack', position: 'FWD' },
  { label: 'Midfield', position: 'MID' },
  { label: 'Defence', position: 'DEF' },
  { label: 'Goal', position: 'GK' },
] as const;

function FixtureSquadView({ squad }: { squad: FixtureSquad }) {
  const starters = squad.squadEntries.filter((entry) => entry.isStarter);
  const bench = squad.squadEntries.filter((entry) => !entry.isStarter);

  if (starters.length === 0) return null;

  return (
    <div className="fixture-selected-squad">
      <p className="eyebrow">Selected squad</p>
      <div className="fixture-squad-pitch" aria-label="Starting six">
        {squadLines.map((line) => (
          <div className="fixture-squad-line" key={line.position}>
            <span>{line.label}</span>
            <div>
              {starters
                .filter((entry) => entry.position === line.position)
                .map((entry) => (
                  <Link
                    key={entry.player.id}
                    to={`/players/${entry.player.id}`}
                  >
                    {entry.player.name}
                  </Link>
                ))}
            </div>
          </div>
        ))}
      </div>
      {bench.length > 0 && (
        <div className="fixture-squad-selected-bench">
          <strong>Bench</strong>
          <div>
            {bench.map((entry) => (
              <Link key={entry.player.id} to={`/players/${entry.player.id}`}>
                {entry.player.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const availabilityOptions: { label: string; response: AvailabilityResponse }[] =
  [
    { label: 'Available', response: 'AVAILABLE' },
    { label: 'Unsure', response: 'UNSURE' },
    { label: 'Unavailable', response: 'UNAVAILABLE' },
  ];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

function formatTime(value: string | null): string {
  return value ? value.slice(11, 16) : 'Kick-off TBC';
}

function formatLastRefreshed(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(new Date(value));
}

export function FixturesPage() {
  const { status: authStatus, user } = useAuth();
  const [fixtures, setFixtures] = useState<FixtureSummary[]>([]);
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [availabilitySnapshot, setAvailabilitySnapshot] = useState<{
    profileKey: string;
    entries: OwnFixtureAvailability[];
    status: 'ready' | 'error';
  } | null>(null);
  const [squadSnapshot, setSquadSnapshot] = useState<{
    profileKey: string;
    entries: FixtureSquad[];
  } | null>(null);
  const [savingFixtureId, setSavingFixtureId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<{
    fixtureId: string;
    message: string;
  } | null>(null);
  const approvedProfileKey =
    authStatus === 'authenticated' &&
    canUsePlayerProfile(user) &&
    user?.playerId
      ? `${user.id}:${user.playerId}`
      : null;
  const currentSnapshot =
    availabilitySnapshot?.profileKey === approvedProfileKey
      ? availabilitySnapshot
      : null;
  const availabilityStatus = approvedProfileKey
    ? (currentSnapshot?.status ?? 'loading')
    : 'idle';
  const availability = currentSnapshot?.entries ?? [];
  const squads =
    squadSnapshot?.profileKey === approvedProfileKey
      ? squadSnapshot.entries
      : [];

  useEffect(() => {
    let isCurrentRequest = true;

    void getUpcomingFixtures()
      .then((snapshot) => {
        if (isCurrentRequest) {
          setFixtures(snapshot.fixtures);
          setScrapeStatus(snapshot.scrapeStatus);
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

  useEffect(() => {
    if (!approvedProfileKey) {
      return;
    }

    let isCurrentRequest = true;
    void Promise.all([getOwnFixtureAvailability(), getUpcomingFixtureSquads()])
      .then(([responses, nextSquads]) => {
        if (isCurrentRequest) {
          setAvailabilitySnapshot({
            profileKey: approvedProfileKey,
            entries: responses,
            status: 'ready',
          });
          setSquadSnapshot({
            entries: nextSquads,
            profileKey: approvedProfileKey,
          });
        }
      })
      .catch(() => {
        if (isCurrentRequest) {
          setAvailabilitySnapshot({
            profileKey: approvedProfileKey,
            entries: [],
            status: 'error',
          });
        }
      });
    return () => {
      isCurrentRequest = false;
    };
  }, [approvedProfileKey]);

  async function saveAvailability(
    fixtureId: string,
    response: AvailabilityResponse,
  ) {
    setSaveError(null);
    setSavingFixtureId(fixtureId);
    try {
      const saved = await setFixtureAvailability(fixtureId, response);
      setAvailabilitySnapshot((current) =>
        current?.profileKey === approvedProfileKey
          ? {
              ...current,
              entries: [
                ...current.entries.filter(
                  (entry) => entry.fixtureId !== fixtureId,
                ),
                saved,
              ],
            }
          : current,
      );
    } catch (error) {
      setSaveError({
        fixtureId,
        message:
          error instanceof Error
            ? error.message
            : 'Your response could not be saved.',
      });
    } finally {
      setSavingFixtureId(null);
    }
  }

  return (
    <section className="content-section">
      <div className="section-heading">
        <p className="eyebrow">Next up</p>
        <h2>Upcoming fixtures</h2>
        <p>
          The next league and cup games for 24 Hour Party People. All kick-off
          times are local to Sheffield.
        </p>
        <p>
          Calendar downloads are a snapshot. Check this page for fixture
          changes.
        </p>
      </div>

      {scrapeStatus?.latestRefreshFailed && (
        <p className="status-panel" role="status">
          The latest automated refresh failed. Showing the last saved fixtures.
        </p>
      )}
      {scrapeStatus?.lastSucceededAt && (
        <p className="standings-last-updated">
          Powerleague last refreshed{' '}
          {formatLastRefreshed(scrapeStatus.lastSucceededAt)}
        </p>
      )}

      {status === 'loading' && (
        <p className="status-panel">Loading upcoming fixtures…</p>
      )}
      {status === 'error' && (
        <p className="status-panel status-panel-error" role="alert">
          Upcoming fixtures could not be loaded.
        </p>
      )}
      {status === 'ready' && fixtures.length === 0 && (
        <p className="status-panel">No upcoming fixtures are scheduled.</p>
      )}

      {status === 'ready' &&
        fixtures.length > 0 &&
        authStatus === 'anonymous' && (
          <p className="status-panel">
            <Link to="/account">Sign in</Link> with an approved player profile
            to respond to a fixture.
          </p>
        )}
      {status === 'ready' &&
        fixtures.length > 0 &&
        canUsePlayerProfile(user) &&
        !user?.playerId && (
          <p className="status-panel">
            Your player profile must be approved before you can respond to
            fixtures.
          </p>
        )}
      {availabilityStatus === 'error' && (
        <p className="status-panel status-panel-error" role="alert">
          Your saved availability could not be loaded. Please refresh before
          responding.
        </p>
      )}

      <div className="fixture-grid">
        {fixtures.map((fixture) => {
          const ownResponse = availability.find(
            (entry) => entry.fixtureId === fixture.id,
          )?.response;
          const squad = squads.find((entry) => entry.id === fixture.id);
          return (
            <article className="fixture-card" key={fixture.id}>
              <div className="fixture-card-meta">
                <span className="competition-label">
                  {fixture.competition === 'LEAGUE' ? 'League' : 'Cup'}
                </span>
                <span>{fixture.season.name}</span>
              </div>
              <p className="fixture-date">
                {formatDate(fixture.scheduledDate)}
              </p>
              <div className="fixture-opponent">
                <div>
                  <p className="eyebrow">Opponent</p>
                  <h3>{fixture.opponentClub.name}</h3>
                </div>
                <p className="fixture-time">
                  {formatTime(fixture.scheduledTime)}
                </p>
              </div>
              {fixture.venue && (
                <p className="fixture-venue">{fixture.venue}</p>
              )}
              {squad && <FixtureSquadView squad={squad} />}
              <button
                className="secondary-button fixture-calendar-button"
                type="button"
                onClick={() => downloadFixtureCalendarEvent(fixture)}
              >
                Add to calendar
              </button>
              {canUsePlayerProfile(user) && user?.playerId && (
                <div className="fixture-availability">
                  <p className="eyebrow">Your availability</p>
                  <div
                    className="fixture-availability-options"
                    role="group"
                    aria-label={`Your availability against ${fixture.opponentClub.name}`}
                  >
                    {availabilityOptions.map((option) => (
                      <button
                        key={option.response}
                        type="button"
                        aria-pressed={ownResponse === option.response}
                        className="secondary-button"
                        disabled={
                          availabilityStatus !== 'ready' ||
                          savingFixtureId !== null
                        }
                        onClick={() =>
                          void saveAvailability(fixture.id, option.response)
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {savingFixtureId === fixture.id && (
                    <p role="status">Saving your response…</p>
                  )}
                  {saveError?.fixtureId === fixture.id && (
                    <p className="fixture-availability-error" role="alert">
                      {saveError.message}
                    </p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
