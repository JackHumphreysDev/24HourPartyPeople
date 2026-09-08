import { useEffect, useState } from 'react';

import { getUpcomingFixtures } from './api';
import type { ScrapeStatus } from '../scrape/types';
import type { FixtureSummary } from './types';

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
  const [fixtures, setFixtures] = useState<FixtureSummary[]>([]);
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );

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

  return (
    <section className="content-section">
      <div className="section-heading">
        <p className="eyebrow">Next up</p>
        <h2>Upcoming fixtures</h2>
        <p>
          The next league and cup games for 24 Hour Party People. All kick-off
          times are local to Sheffield.
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

      <div className="fixture-grid">
        {fixtures.map((fixture) => (
          <article className="fixture-card" key={fixture.id}>
            <div className="fixture-card-meta">
              <span className="competition-label">
                {fixture.competition === 'LEAGUE' ? 'League' : 'Cup'}
              </span>
              <span>{fixture.season.name}</span>
            </div>
            <p className="fixture-date">{formatDate(fixture.scheduledDate)}</p>
            <div className="fixture-opponent">
              <div>
                <p className="eyebrow">Opponent</p>
                <h3>{fixture.opponentClub.name}</h3>
              </div>
              <p className="fixture-time">
                {formatTime(fixture.scheduledTime)}
              </p>
            </div>
            {fixture.venue && <p className="fixture-venue">{fixture.venue}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
