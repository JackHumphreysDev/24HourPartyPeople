import { useEffect, useState, type FormEvent } from 'react';

import { AuthScreen } from '../AuthScreen';
import { AdminNavigation } from '../admin/AdminNavigation';
import { useAuth } from '../auth/useAuth';
import {
  createSeason,
  getAdminPlayers,
  getAdminSeasons,
  getPlayerSeasonStats,
  savePlayerSeasonStats,
  updateSeason,
} from './api';
import type {
  AdminSeasonStat,
  PlayerSummary,
  SeasonInput,
  SeasonSummary,
} from './types';

const emptySeasonInput: SeasonInput = {
  endDate: '',
  isCurrent: false,
  name: '',
  startDate: '',
  tracksGamesPlayed: false,
};

type StatDraft = {
  assists: string;
  cleanSheets: string;
  gamesPlayed: string;
  goals: string;
  note: string;
};

const emptyStatDraft: StatDraft = {
  assists: '0',
  cleanSheets: '0',
  gamesPlayed: '0',
  goals: '0',
  note: '',
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The request could not be completed.';
}

function dateInputValue(value: string): string {
  return value.slice(0, 10);
}

function statDraftFor(
  seasonId: string,
  stats: AdminSeasonStat[],
  seasons: SeasonSummary[],
): StatDraft {
  const existing = stats.find((stat) => stat.seasonId === seasonId);
  const season = seasons.find((item) => item.id === seasonId);

  return existing
    ? {
        assists: String(existing.assists),
        cleanSheets: String(existing.cleanSheets),
        gamesPlayed:
          existing.gamesPlayed === null ? '' : String(existing.gamesPlayed),
        goals: String(existing.goals),
        note: existing.note ?? '',
      }
    : {
        ...emptyStatDraft,
        gamesPlayed: season?.tracksGamesPlayed ? '0' : '',
      };
}

function StatisticsManager() {
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [seasonInput, setSeasonInput] = useState<SeasonInput>(emptySeasonInput);
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null);
  const [seasonError, setSeasonError] = useState<string | null>(null);
  const [isSavingSeason, setIsSavingSeason] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [selectedSeasonId, setSelectedSeasonId] = useState('');
  const [playerStats, setPlayerStats] = useState<AdminSeasonStat[]>([]);
  const [statsStatus, setStatsStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [statDraft, setStatDraft] = useState<StatDraft>(emptyStatDraft);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [isSavingStats, setIsSavingStats] = useState(false);

  useEffect(() => {
    let isCurrentRequest = true;

    void Promise.all([getAdminSeasons(), getAdminPlayers()])
      .then(([nextSeasons, nextPlayers]) => {
        if (!isCurrentRequest) {
          return;
        }

        setSeasons(nextSeasons);
        setPlayers(nextPlayers);
        setSelectedSeasonId(
          nextSeasons.find((season) => season.isCurrent)?.id ??
            nextSeasons[0]?.id ??
            '',
        );
        setStatsStatus(nextPlayers.length > 0 ? 'loading' : 'idle');
        setSelectedPlayerId(nextPlayers[0]?.id ?? '');
        if (nextSeasons.length === 0) {
          setSeasonInput({
            ...emptySeasonInput,
            isCurrent: true,
            tracksGamesPlayed: true,
          });
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

  useEffect(() => {
    if (!selectedPlayerId) {
      return;
    }

    let isCurrentRequest = true;

    void getPlayerSeasonStats(selectedPlayerId)
      .then((nextStats) => {
        if (isCurrentRequest) {
          setPlayerStats(nextStats);
          setStatDraft(statDraftFor(selectedSeasonId, nextStats, seasons));
          setStatsStatus('ready');
        }
      })
      .catch(() => {
        if (isCurrentRequest) {
          setStatsStatus('error');
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [selectedPlayerId, selectedSeasonId, seasons]);

  function editSeason(season: SeasonSummary) {
    setEditingSeasonId(season.id);
    setSeasonInput({
      endDate: dateInputValue(season.endDate),
      isCurrent: season.isCurrent,
      name: season.name,
      startDate: dateInputValue(season.startDate),
      tracksGamesPlayed: season.tracksGamesPlayed,
    });
    setSeasonError(null);
  }

  function resetSeasonForm() {
    setEditingSeasonId(null);
    setSeasonInput({
      ...emptySeasonInput,
      isCurrent: seasons.length === 0,
      tracksGamesPlayed: false,
    });
    setSeasonError(null);
  }

  async function handleSeasonSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSeasonError(null);
    setIsSavingSeason(true);

    try {
      const savedSeason = editingSeasonId
        ? await updateSeason(editingSeasonId, seasonInput)
        : await createSeason(seasonInput);
      const nextSeasons = await getAdminSeasons();
      setSeasons(nextSeasons);
      const nextSelectedSeasonId = selectedSeasonId || savedSeason.id;
      setSelectedSeasonId(nextSelectedSeasonId);
      setStatDraft(
        statDraftFor(nextSelectedSeasonId, playerStats, nextSeasons),
      );
      setEditingSeasonId(null);
      setSeasonInput(emptySeasonInput);
    } catch (requestError) {
      setSeasonError(errorMessage(requestError));
    } finally {
      setIsSavingSeason(false);
    }
  }

  async function handleStatsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedSeason = seasons.find(
      (season) => season.id === selectedSeasonId,
    );
    if (!selectedPlayerId || !selectedSeason) {
      return;
    }

    setStatsError(null);
    setIsSavingStats(true);

    try {
      const savedStats = await savePlayerSeasonStats(selectedPlayerId, {
        assists: Number(statDraft.assists),
        cleanSheets: Number(statDraft.cleanSheets),
        gamesPlayed: selectedSeason.tracksGamesPlayed
          ? Number(statDraft.gamesPlayed)
          : null,
        goals: Number(statDraft.goals),
        note: statDraft.note.trim() || null,
        seasonId: selectedSeason.id,
      });
      setPlayerStats((currentStats) => {
        const exists = currentStats.some(
          (stat) => stat.seasonId === savedStats.seasonId,
        );
        return exists
          ? currentStats.map((stat) =>
              stat.seasonId === savedStats.seasonId ? savedStats : stat,
            )
          : [...currentStats, savedStats];
      });
    } catch (requestError) {
      setStatsError(errorMessage(requestError));
    } finally {
      setIsSavingStats(false);
    }
  }

  const editingSeason = seasons.find((season) => season.id === editingSeasonId);
  const selectedSeason = seasons.find(
    (season) => season.id === selectedSeasonId,
  );

  return (
    <section className="statistics-admin-page">
      <AdminNavigation />

      <div className="admin-layout">
        <div className="admin-player-list">
          <div className="section-heading section-heading-compact">
            <p className="eyebrow">Administrator</p>
            <h2>Manage seasons</h2>
            <p>
              Keep one season current and preserve whether games played was
              recorded.
            </p>
          </div>

          {loadStatus === 'loading' && (
            <p className="status-panel">Loading seasons…</p>
          )}
          {loadStatus === 'error' && (
            <p className="status-panel status-panel-error" role="alert">
              Seasons and players could not be loaded.
            </p>
          )}
          {loadStatus === 'ready' && seasons.length === 0 && (
            <p className="status-panel">No seasons have been created.</p>
          )}

          <div className="admin-player-items">
            {seasons.map((season) => (
              <article className="admin-player-item" key={season.id}>
                <div>
                  <p className="position-label">
                    {season.isCurrent ? 'Current season' : 'Historic season'} ·{' '}
                    {season.tracksGamesPlayed
                      ? 'Games tracked'
                      : 'Games not recorded'}
                  </p>
                  <h3>{season.name}</h3>
                  <p className="admin-item-detail">
                    {dateInputValue(season.startDate)} to{' '}
                    {dateInputValue(season.endDate)}
                  </p>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => editSeason(season)}
                >
                  Edit
                </button>
              </article>
            ))}
          </div>
        </div>

        <form className="admin-player-form" onSubmit={handleSeasonSubmit}>
          <div className="admin-form-heading">
            <div>
              <p className="eyebrow">
                {editingSeason ? 'Update season' : 'New season'}
              </p>
              <h3>{editingSeason?.name ?? 'Add a season'}</h3>
            </div>
            {editingSeason && (
              <button
                className="text-button"
                type="button"
                onClick={resetSeasonForm}
              >
                Cancel
              </button>
            )}
          </div>

          <label>
            Season name
            <input
              maxLength={100}
              required
              value={seasonInput.name}
              onChange={(event) =>
                setSeasonInput({ ...seasonInput, name: event.target.value })
              }
            />
          </label>

          <label>
            Start date
            <input
              required
              type="date"
              value={seasonInput.startDate}
              onChange={(event) =>
                setSeasonInput({
                  ...seasonInput,
                  startDate: event.target.value,
                })
              }
            />
          </label>

          <label>
            End date
            <input
              min={seasonInput.startDate}
              required
              type="date"
              value={seasonInput.endDate}
              onChange={(event) =>
                setSeasonInput({ ...seasonInput, endDate: event.target.value })
              }
            />
          </label>

          <label className="checkbox-label">
            <input
              checked={seasonInput.isCurrent}
              disabled={editingSeason?.isCurrent}
              type="checkbox"
              onChange={(event) =>
                setSeasonInput({
                  ...seasonInput,
                  isCurrent: event.target.checked,
                })
              }
            />
            Current season
          </label>
          {editingSeason?.isCurrent && (
            <span className="field-hint">
              Make another season current to replace this one.
            </span>
          )}

          <label className="checkbox-label">
            <input
              checked={seasonInput.tracksGamesPlayed}
              type="checkbox"
              onChange={(event) =>
                setSeasonInput({
                  ...seasonInput,
                  tracksGamesPlayed: event.target.checked,
                })
              }
            />
            Games played was recorded
          </label>

          {seasonError && (
            <p className="form-error" role="alert">
              {seasonError}
            </p>
          )}

          <button
            className="primary-button"
            disabled={isSavingSeason}
            type="submit"
          >
            {isSavingSeason
              ? 'Saving…'
              : editingSeason
                ? 'Save season'
                : 'Create season'}
          </button>
        </form>
      </div>

      <section className="statistics-editor">
        <div className="section-heading section-heading-compact">
          <p className="eyebrow">Player records</p>
          <h2>Manage statistics</h2>
          <p>
            Add or update a player’s totals for a season. Saving an existing
            player and season combination replaces its previous values.
          </p>
        </div>

        {players.length === 0 || seasons.length === 0 ? (
          <p className="status-panel">
            Create at least one player and one season before adding statistics.
          </p>
        ) : (
          <form className="statistics-form" onSubmit={handleStatsSubmit}>
            <label>
              Player
              <select
                value={selectedPlayerId}
                onChange={(event) => {
                  setStatsStatus('loading');
                  setSelectedPlayerId(event.target.value);
                }}
              >
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                    {player.isActiveSquad ? '' : ' (inactive)'}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Season
              <select
                value={selectedSeasonId}
                onChange={(event) => {
                  const seasonId = event.target.value;
                  setSelectedSeasonId(seasonId);
                  setStatDraft(statDraftFor(seasonId, playerStats, seasons));
                  setStatsError(null);
                  setStatsStatus('loading');
                }}
              >
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                    {season.isCurrent ? ' (current)' : ''}
                  </option>
                ))}
              </select>
            </label>

            {selectedSeason?.tracksGamesPlayed && (
              <p className="form-warning statistics-form-message">
                This season is calculated from per-game contributions. Update
                them from the Results administration page.
              </p>
            )}

            <label>
              Goals
              <input
                disabled={selectedSeason?.tracksGamesPlayed}
                max={10000}
                min={0}
                required
                step={1}
                type="number"
                value={statDraft.goals}
                onChange={(event) =>
                  setStatDraft({ ...statDraft, goals: event.target.value })
                }
              />
            </label>

            <label>
              Assists
              <input
                disabled={selectedSeason?.tracksGamesPlayed}
                max={10000}
                min={0}
                required
                step={1}
                type="number"
                value={statDraft.assists}
                onChange={(event) =>
                  setStatDraft({ ...statDraft, assists: event.target.value })
                }
              />
            </label>

            <label>
              Clean sheets
              <input
                disabled={selectedSeason?.tracksGamesPlayed}
                max={10000}
                min={0}
                required
                step={1}
                type="number"
                value={statDraft.cleanSheets}
                onChange={(event) =>
                  setStatDraft({
                    ...statDraft,
                    cleanSheets: event.target.value,
                  })
                }
              />
            </label>

            <label>
              Games played
              <input
                disabled
                max={10000}
                min={0}
                step={1}
                type="number"
                value={statDraft.gamesPlayed}
                onChange={(event) =>
                  setStatDraft({
                    ...statDraft,
                    gamesPlayed: event.target.value,
                  })
                }
              />
              <span className="field-hint">
                {selectedSeason?.tracksGamesPlayed
                  ? 'Calculated from selected game appearances'
                  : 'Not recorded'}
              </span>
            </label>

            <label className="statistics-note-field">
              Note
              <textarea
                disabled={selectedSeason?.tracksGamesPlayed}
                maxLength={500}
                rows={3}
                value={statDraft.note}
                onChange={(event) =>
                  setStatDraft({ ...statDraft, note: event.target.value })
                }
              />
            </label>

            {statsStatus === 'loading' && (
              <p className="field-hint statistics-form-message">
                Loading this player’s statistics…
              </p>
            )}
            {statsStatus === 'error' && (
              <p className="form-error statistics-form-message" role="alert">
                This player’s statistics could not be loaded.
              </p>
            )}
            {statsError && (
              <p className="form-error statistics-form-message" role="alert">
                {statsError}
              </p>
            )}

            <button
              className="primary-button statistics-form-action"
              disabled={
                isSavingStats ||
                statsStatus === 'loading' ||
                selectedSeason?.tracksGamesPlayed
              }
              type="submit"
            >
              {isSavingStats ? 'Saving…' : 'Save statistics'}
            </button>
          </form>
        )}
      </section>
    </section>
  );
}

export function AdminStatisticsPage() {
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

  return <StatisticsManager />;
}
