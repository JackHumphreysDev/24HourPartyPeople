import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getUpcomingFixtures } from './fixtures/api';
import { downloadFixtureCalendarEvent } from './fixtures/calendar';
import type { FixtureSummary } from './fixtures/types';
import { getTeamProfile } from './home/api';
import type { TeamProfile } from './home/types';
import { getPlayers } from './players/api';
import { PlayerAvatar } from './players/PlayerAvatar';
import type { PlayerPosition, PlayerSummary } from './players/types';
import { positionLabels } from './players/types';
import { getCurrentStandings } from './standings/api';
import type { StandingsSnapshot } from './standings/types';

const TEAM_NAME = '24 Hour Party People';
const DEFAULT_DESCRIPTION =
  'The home of 24 Hour Party People—bringing the squad, statistics, fixtures, results, and club history together.';

const FORMATION_LINES: ReadonlyArray<{
  label: string;
  position: PlayerPosition;
  slots: number;
}> = [
  { label: 'Forward', position: 'FWD', slots: 1 },
  { label: 'Midfield', position: 'MID', slots: 1 },
  { label: 'Defence', position: 'DEF', slots: 3 },
  { label: 'Goalkeeper', position: 'GK', slots: 1 },
];

type HomeData = {
  players: PlayerSummary[];
  standings: StandingsSnapshot;
  teamProfile: TeamProfile;
};

function ordinal(value: number): string {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

function formatFixtureDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    weekday: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatShortFixtureDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    weekday: 'short',
  }).format(new Date(value));
}

function formatFixtureTime(value: string | null): string {
  return value ? value.slice(11, 16) : 'TBC';
}

function opponentInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [fixtures, setFixtures] = useState<FixtureSummary[]>([]);
  const [fixtureStatus, setFixtureStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading');

  useEffect(() => {
    let isCurrentRequest = true;

    void Promise.all([getTeamProfile(), getPlayers(), getCurrentStandings()])
      .then(([teamProfile, players, standings]) => {
        if (isCurrentRequest) {
          setData({ players, standings, teamProfile });
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
    let isCurrentRequest = true;

    void getUpcomingFixtures()
      .then((snapshot) => {
        if (isCurrentRequest) {
          setFixtures(snapshot.fixtures.slice(0, 5));
          setFixtureStatus('ready');
        }
      })
      .catch(() => {
        if (isCurrentRequest) {
          setFixtureStatus('error');
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, []);

  const teamStanding = data?.standings.standings.find(
    (standing) =>
      standing.clubName.toLocaleLowerCase('en-GB') ===
      TEAM_NAME.toLocaleLowerCase('en-GB'),
  );
  const nextFixture = fixtures[0];
  const startingPlayers =
    data?.players.filter((player) => !player.isOnBench) ?? [];
  const benchPlayers = data?.players.filter((player) => player.isOnBench) ?? [];
  const seasonName = data?.standings.season?.name ?? nextFixture?.season.name;

  return (
    <section
      className="home-page home-dashboard"
      aria-labelledby="home-heading"
    >
      <div className="home-dashboard-meta">
        <p className="eyebrow">{seasonName ?? 'Current season'}</p>
        <div className="home-dashboard-meta-copy" aria-label="Club details">
          <span>6-a-side</span>
          <span aria-hidden="true" />
          <span>Sheffield</span>
          <span aria-hidden="true" />
          <span>Football, friends, and the full story.</span>
        </div>
      </div>

      <div className="home-dashboard-lead">
        <article className="dashboard-panel next-fixture-panel">
          <header className="dashboard-panel-heading">
            <h2 id="home-heading">Next fixture</h2>
            <span>League match</span>
          </header>

          {fixtureStatus === 'loading' && (
            <p className="dashboard-empty-state">Loading the next fixture…</p>
          )}
          {fixtureStatus === 'error' && (
            <p
              className="dashboard-empty-state dashboard-empty-state-error"
              role="alert"
            >
              The next fixture could not be loaded.
            </p>
          )}
          {fixtureStatus === 'ready' && !nextFixture && (
            <p className="dashboard-empty-state">
              No upcoming fixture is scheduled.
            </p>
          )}
          {fixtureStatus === 'ready' && nextFixture && (
            <>
              <div className="next-fixture-teams">
                <div className="next-fixture-team">
                  <img
                    src="/assets/brand/logo-transparent-512.png"
                    alt=""
                    aria-hidden="true"
                  />
                  <strong>24 HPP</strong>
                </div>
                <div className="next-fixture-versus" aria-hidden="true">
                  <span />
                  <b>vs</b>
                  <span />
                </div>
                <div className="next-fixture-team">
                  <div className="opponent-mark" aria-hidden="true">
                    {opponentInitials(nextFixture.opponentClub.name)}
                  </div>
                  <strong>{nextFixture.opponentClub.name}</strong>
                </div>
              </div>

              <dl className="next-fixture-details">
                <div>
                  <dt>Date</dt>
                  <dd>{formatShortFixtureDate(nextFixture.scheduledDate)}</dd>
                </div>
                <div>
                  <dt>Kick-off</dt>
                  <dd>{formatFixtureTime(nextFixture.scheduledTime)}</dd>
                </div>
                <div>
                  <dt>Venue</dt>
                  <dd>{nextFixture.venue ?? 'TBC'}</dd>
                </div>
              </dl>
            </>
          )}
        </article>

        <aside
          className="dashboard-panel league-position-card"
          aria-label="League position"
        >
          <header className="dashboard-panel-heading">
            <h2>Current position</h2>
          </header>
          <div className="league-position-body">
            {status === 'loading' && <p>Loading…</p>}
            {status === 'error' && <p>Position unavailable</p>}
            {status === 'ready' && teamStanding && (
              <>
                <strong>{ordinal(teamStanding.position)}</strong>
                <span>{data?.standings.season?.name}</span>
                <dl className="league-position-stats">
                  <div>
                    <dt>Played</dt>
                    <dd>{teamStanding.played}</dd>
                  </div>
                  <div>
                    <dt>Won</dt>
                    <dd>{teamStanding.won}</dd>
                  </div>
                  <div>
                    <dt>Drawn</dt>
                    <dd>{teamStanding.drawn}</dd>
                  </div>
                  <div>
                    <dt>Lost</dt>
                    <dd>{teamStanding.lost}</dd>
                  </div>
                  <div>
                    <dt>GD</dt>
                    <dd>
                      {teamStanding.gd > 0
                        ? `+${teamStanding.gd}`
                        : teamStanding.gd}
                    </dd>
                  </div>
                </dl>
                <Link to="/standings">View the full table</Link>
              </>
            )}
            {status === 'ready' && !teamStanding && (
              <p>No current league position has been recorded.</p>
            )}
          </div>
        </aside>
      </div>

      {status === 'error' && (
        <p className="status-panel status-panel-error" role="alert">
          The latest team information could not be loaded. Please try again.
        </p>
      )}

      <section
        className="home-fixtures-section dashboard-panel"
        aria-labelledby="home-fixtures-heading"
        aria-label="Next fixtures"
      >
        <header className="dashboard-panel-heading dashboard-panel-heading-link">
          <div>
            <h2 id="home-fixtures-heading">Next fixtures</h2>
            <p>
              Our next five league and cup games. Times are local to Sheffield.
            </p>
            <p>Calendar downloads will not update if a fixture changes.</p>
          </div>
          <Link to="/fixtures">
            View all fixtures <span aria-hidden="true">↗</span>
          </Link>
        </header>

        {fixtureStatus === 'loading' && (
          <p className="status-panel">Loading upcoming fixtures…</p>
        )}
        {fixtureStatus === 'error' && (
          <p className="status-panel status-panel-error" role="alert">
            The fixture timetable could not be loaded.
          </p>
        )}
        {fixtureStatus === 'ready' && fixtures.length === 0 && (
          <p className="status-panel">No upcoming fixtures are scheduled.</p>
        )}
        {fixtureStatus === 'ready' && fixtures.length > 0 && (
          <div
            className="table-scroll"
            role="region"
            aria-label="Fixture timetable table"
            tabIndex={0}
          >
            <table className="home-fixtures-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Kick-off</th>
                  <th scope="col">Opponent</th>
                  <th scope="col">Competition</th>
                  <th scope="col">Venue</th>
                  <th scope="col">Calendar</th>
                </tr>
              </thead>
              <tbody>
                {fixtures.map((fixture, index) => (
                  <tr
                    className={index === 0 ? 'is-next-fixture' : undefined}
                    key={fixture.id}
                  >
                    <td>{formatFixtureDate(fixture.scheduledDate)}</td>
                    <td>{formatFixtureTime(fixture.scheduledTime)}</td>
                    <th scope="row">{fixture.opponentClub.name}</th>
                    <td>
                      {fixture.competition === 'LEAGUE' ? 'League' : 'Cup'}
                    </td>
                    <td>{fixture.venue ?? 'TBC'}</td>
                    <td>
                      <button
                        className="secondary-button"
                        type="button"
                        aria-label={`Add ${fixture.opponentClub.name} fixture to calendar`}
                        onClick={() => downloadFixtureCalendarEvent(fixture)}
                      >
                        Add to calendar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="home-dashboard-lower">
        <section className="home-formation-section dashboard-panel">
          <header className="dashboard-panel-heading">
            <div>
              <h2>Starting six</h2>
              <p>Our active 1–3–1–1 six-a-side formation.</p>
            </div>
            <span>1–3–1–1 formation</span>
          </header>

          {status === 'loading' && (
            <p className="status-panel">Loading the current squad…</p>
          )}
          {status === 'ready' && data?.players.length === 0 && (
            <p className="status-panel">The current squad will appear here.</p>
          )}
          {status === 'ready' && data && data.players.length > 0 && (
            <div
              className="formation-pitch"
              aria-label="Current squad formation"
            >
              {FORMATION_LINES.map((line) => {
                const players = startingPlayers.filter(
                  (player) => player.position === line.position,
                );

                return (
                  <div className="formation-line" key={line.position}>
                    <span className="formation-line-label">{line.label}</span>
                    <div className="formation-player-row">
                      {Array.from({ length: line.slots }, (_, index) => {
                        const player = players[index];
                        return player ? (
                          <Link
                            className="formation-player"
                            key={player.id}
                            to={`/players/${player.id}`}
                          >
                            <PlayerAvatar player={player} />
                            <strong>{player.name}</strong>
                            <span>{positionLabels[line.position]}</span>
                          </Link>
                        ) : (
                          <div
                            className="formation-player formation-player-empty"
                            key={`${line.position}-${index}`}
                          >
                            <span aria-hidden="true">+</span>
                            <strong>Squad place</strong>
                            <span>Available</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {status === 'ready' && benchPlayers.length > 0 && (
            <div className="formation-bench" aria-label="Current substitutes">
              <div className="section-heading section-heading-compact">
                <p className="eyebrow">Substitutes</p>
                <h3>Bench</h3>
              </div>
              <div className="formation-bench-players">
                {benchPlayers.map((player) => (
                  <Link
                    className="formation-player formation-bench-player"
                    key={player.id}
                    to={`/players/${player.id}`}
                  >
                    <PlayerAvatar player={player} />
                    <strong>{player.name}</strong>
                    <span>
                      {player.position
                        ? positionLabels[player.position]
                        : 'Position pending'}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="dashboard-panel club-notes-panel">
          <header className="dashboard-panel-heading">
            <h2>Club notes</h2>
          </header>
          <div className="club-notes-body">
            <p className="club-notes-lead">
              Football, friends, and the full story.
            </p>
            <p>{data?.teamProfile.description ?? DEFAULT_DESCRIPTION}</p>
            <span aria-hidden="true" />
            <Link to="/club-history">
              More about the club <b aria-hidden="true">↗</b>
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
