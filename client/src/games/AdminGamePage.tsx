import { useEffect, useState, type FormEvent } from 'react';
import { NavLink } from 'react-router-dom';

import { AuthScreen } from '../AuthScreen';
import { useAuth } from '../auth/useAuth';
import { getAdminSeasons } from '../players/api';
import type { SeasonSummary } from '../players/types';
import { createGame, getAdminFixtures } from './api';
import type { AdminFixture, Competition, GameResultInput } from './types';

function dateInputValue(value: string): string {
  return value.slice(0, 10);
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The result could not be recorded.';
}

function GameResultManager() {
  const [fixtures, setFixtures] = useState<AdminFixture[]>([]);
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [entryMode, setEntryMode] = useState<'fixture' | 'manual'>('manual');
  const [fixtureId, setFixtureId] = useState('');
  const [seasonId, setSeasonId] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [datePlayed, setDatePlayed] = useState('');
  const [competition, setCompetition] = useState<Competition>('LEAGUE');
  const [isWalkover, setIsWalkover] = useState(false);
  const [ourScore, setOurScore] = useState('');
  const [opponentScore, setOpponentScore] = useState('');
  const [walkoverReason, setWalkoverReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [standingsRefreshRequired, setStandingsRefreshRequired] =
    useState(false);

  useEffect(() => {
    let isCurrentRequest = true;

    void Promise.all([getAdminFixtures(), getAdminSeasons()])
      .then(([nextFixtures, nextSeasons]) => {
        if (!isCurrentRequest) {
          return;
        }

        setFixtures(nextFixtures);
        setSeasons(nextSeasons);
        setSeasonId(
          nextSeasons.find((season) => season.isCurrent)?.id ??
            nextSeasons[0]?.id ??
            '',
        );
        if (nextFixtures.length > 0) {
          setEntryMode('fixture');
          setFixtureId(nextFixtures[0]?.id ?? '');
        }
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

  const selectedFixture = fixtures.find((fixture) => fixture.id === fixtureId);
  const selectedSeason = seasons.find((season) => season.id === seasonId);
  const selectedCompetition =
    entryMode === 'fixture'
      ? (selectedFixture?.competition ?? 'LEAGUE')
      : competition;

  function selectEntryMode(mode: 'fixture' | 'manual') {
    setEntryMode(mode);
    setError(null);
    setSuccessMessage(null);
    if (
      mode === 'fixture' &&
      fixtures.find((fixture) => fixture.id === fixtureId)?.competition ===
        'CUP'
    ) {
      setIsWalkover(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (entryMode === 'fixture' && !fixtureId) {
      return;
    }
    if (entryMode === 'manual' && !seasonId) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setStandingsRefreshRequired(false);
    setIsSubmitting(true);

    const resultValues = {
      isWalkover,
      opponentScore: isWalkover ? null : Number(opponentScore),
      ourScore: isWalkover ? null : Number(ourScore),
      walkoverReason: isWalkover ? walkoverReason.trim() || null : null,
    };
    const input: GameResultInput =
      entryMode === 'fixture'
        ? {
            entryMode: 'fixture',
            fixtureId,
            ...resultValues,
          }
        : {
            competition,
            datePlayed,
            entryMode: 'manual',
            opponentName,
            seasonId,
            ...resultValues,
          };

    try {
      const created = await createGame(input);
      const remainingFixtures = fixtures.filter(
        (fixture) => fixture.id !== created.game.fixtureId,
      );
      setFixtures(remainingFixtures);
      setStandingsRefreshRequired(created.standingsRefreshRequired);
      setOurScore('');
      setOpponentScore('');
      setWalkoverReason('');
      setIsWalkover(false);

      if (created.game.isWalkover && created.game.competition === 'LEAGUE') {
        setEntryMode('manual');
        setSeasonId(created.game.season.id);
        setOpponentName(created.game.opponentClub.name);
        setDatePlayed(dateInputValue(created.game.datePlayed));
        setCompetition('CUP');
        setSuccessMessage(
          'League walkover saved. Add the cup result played instead.',
        );
      } else {
        setSuccessMessage('Result recorded successfully.');
        if (entryMode === 'fixture') {
          setFixtureId(remainingFixtures[0]?.id ?? '');
          if (remainingFixtures.length === 0) {
            setEntryMode('manual');
          }
        }
      }
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loadStatus === 'loading') {
    return <p className="status-panel">Loading result options…</p>;
  }

  if (loadStatus === 'error') {
    return (
      <p className="status-panel status-panel-error" role="alert">
        Seasons and fixtures could not be loaded.
      </p>
    );
  }

  return (
    <section className="game-admin-page">
      <div className="section-heading">
        <p className="eyebrow">Administrator</p>
        <h2>Record a result</h2>
        <p>
          Use a scheduled fixture when one is available, or enter a league or
          cup game manually.
        </p>
      </div>

      {seasons.length === 0 ? (
        <p className="status-panel">
          Create a season before recording a game result.
        </p>
      ) : (
        <form className="game-result-form" onSubmit={handleSubmit}>
          <div className="entry-mode-tabs" aria-label="Result entry source">
            <button
              className={entryMode === 'fixture' ? 'entry-mode-active' : ''}
              disabled={fixtures.length === 0}
              type="button"
              onClick={() => selectEntryMode('fixture')}
            >
              Scheduled fixture
            </button>
            <button
              className={entryMode === 'manual' ? 'entry-mode-active' : ''}
              type="button"
              onClick={() => selectEntryMode('manual')}
            >
              Manual game
            </button>
          </div>

          {fixtures.length === 0 && (
            <p className="field-hint">
              No scheduled fixtures are available; enter this game manually.
            </p>
          )}

          {entryMode === 'fixture' ? (
            <>
              <label>
                Scheduled fixture
                <select
                  required
                  value={fixtureId}
                  onChange={(event) => {
                    const nextFixtureId = event.target.value;
                    setFixtureId(nextFixtureId);
                    if (
                      fixtures.find((fixture) => fixture.id === nextFixtureId)
                        ?.competition === 'CUP'
                    ) {
                      setIsWalkover(false);
                    }
                  }}
                >
                  {fixtures.map((fixture) => (
                    <option key={fixture.id} value={fixture.id}>
                      {dateInputValue(fixture.scheduledDate)} ·{' '}
                      {fixture.opponentClub.name} ·{' '}
                      {fixture.competition === 'LEAGUE' ? 'League' : 'Cup'}
                    </option>
                  ))}
                </select>
              </label>
              {selectedFixture && (
                <p className="fixture-detail">
                  {selectedFixture.season.name}
                  {selectedFixture.venue ? ` · ${selectedFixture.venue}` : ''}
                </p>
              )}
            </>
          ) : (
            <div className="manual-result-fields">
              <label>
                Season
                <select
                  required
                  value={seasonId}
                  onChange={(event) => setSeasonId(event.target.value)}
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
                  value={opponentName}
                  onChange={(event) => setOpponentName(event.target.value)}
                />
              </label>

              <label>
                Date played
                <input
                  max={selectedSeason && dateInputValue(selectedSeason.endDate)}
                  min={
                    selectedSeason && dateInputValue(selectedSeason.startDate)
                  }
                  required
                  type="date"
                  value={datePlayed}
                  onChange={(event) => setDatePlayed(event.target.value)}
                />
              </label>

              <label>
                Competition
                <select
                  value={competition}
                  onChange={(event) => {
                    const nextCompetition = event.target.value as Competition;
                    setCompetition(nextCompetition);
                    if (nextCompetition === 'CUP') {
                      setIsWalkover(false);
                    }
                  }}
                >
                  <option value="LEAGUE">League</option>
                  <option value="CUP">Cup</option>
                </select>
              </label>
            </div>
          )}

          {selectedCompetition === 'LEAGUE' && (
            <label className="checkbox-label walkover-control">
              <input
                checked={isWalkover}
                type="checkbox"
                onChange={(event) => {
                  setIsWalkover(event.target.checked);
                  if (event.target.checked) {
                    setOurScore('');
                    setOpponentScore('');
                  }
                }}
              />
              This league game was a walkover
            </label>
          )}

          {isWalkover ? (
            <label>
              Walkover reason (optional)
              <textarea
                maxLength={500}
                rows={3}
                value={walkoverReason}
                onChange={(event) => setWalkoverReason(event.target.value)}
              />
              <span className="field-hint">
                Scores stay blank. After saving, the cup result form will be
                prepared for the same date and opponent.
              </span>
            </label>
          ) : (
            <div className="score-entry-fields">
              <label>
                Our score
                <input
                  min={0}
                  required
                  step={1}
                  type="number"
                  value={ourScore}
                  onChange={(event) => setOurScore(event.target.value)}
                />
              </label>
              <label>
                Opponent score
                <input
                  min={0}
                  required
                  step={1}
                  type="number"
                  value={opponentScore}
                  onChange={(event) => setOpponentScore(event.target.value)}
                />
              </label>
            </div>
          )}

          {successMessage && (
            <p className="form-success" role="status">
              {successMessage}
            </p>
          )}
          {standingsRefreshRequired && (
            <p className="form-warning">
              The league standings now need refreshing. Automatic scraping is
              not connected yet.
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="game-form-actions">
            <button
              className="primary-button"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? 'Saving…' : 'Save result'}
            </button>
            <NavLink className="secondary-link" to="/games">
              View game history
            </NavLink>
          </div>
        </form>
      )}
    </section>
  );
}

export function AdminGamePage() {
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
      <GameResultManager />
    </>
  );
}
