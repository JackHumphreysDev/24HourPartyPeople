import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

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

export function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );

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

  const teamStanding = data?.standings.standings.find(
    (standing) =>
      standing.clubName.toLocaleLowerCase('en-GB') ===
      TEAM_NAME.toLocaleLowerCase('en-GB'),
  );
  const startingPlayers =
    data?.players.filter((player) => !player.isOnBench) ?? [];
  const benchPlayers = data?.players.filter((player) => player.isOnBench) ?? [];

  return (
    <section className="home-page" aria-labelledby="home-heading">
      <div className="home-hero">
        <div className="home-hero-copy">
          <img
            className="home-logo"
            src="/assets/brand/logo-transparent-512.webp"
            alt="24 Hour Party People club crest"
          />
          <p className="eyebrow">Established 2016</p>
          <h2 id="home-heading">Football, friends, and the full story.</h2>
          <p>{data?.teamProfile.description ?? DEFAULT_DESCRIPTION}</p>
          <Link className="primary-link" to="/players">
            Meet the squad
          </Link>
        </div>

        <aside className="league-position-card" aria-label="League position">
          <p className="eyebrow">Current league position</p>
          {status === 'loading' && <p>Loading…</p>}
          {status === 'error' && <p>Position unavailable</p>}
          {status === 'ready' && teamStanding && (
            <>
              <strong>{ordinal(teamStanding.position)}</strong>
              <span>{data?.standings.season?.name}</span>
              <Link to="/standings">View the full table</Link>
            </>
          )}
          {status === 'ready' && !teamStanding && (
            <p>No current league position has been recorded.</p>
          )}
        </aside>
      </div>

      {status === 'error' && (
        <p className="status-panel status-panel-error" role="alert">
          The latest team information could not be loaded. Please try again.
        </p>
      )}

      <div className="home-formation-section">
        <div className="section-heading">
          <p className="eyebrow">Starting six</p>
          <h2>Current squad</h2>
          <p>Our active 1–3–1–1 six-a-side formation.</p>
        </div>

        {status === 'loading' && (
          <p className="status-panel">Loading the current squad…</p>
        )}
        {status === 'ready' && data?.players.length === 0 && (
          <p className="status-panel">The current squad will appear here.</p>
        )}
        {status === 'ready' && data && data.players.length > 0 && (
          <div className="formation-pitch" aria-label="Current squad formation">
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
      </div>
    </section>
  );
}
