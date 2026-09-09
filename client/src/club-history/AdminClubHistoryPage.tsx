import { useEffect, useState, type FormEvent } from 'react';

import { AuthScreen } from '../AuthScreen';
import { AdminNavigation } from '../admin/AdminNavigation';
import { useAuth } from '../auth/useAuth';
import {
  finaliseClubHistory,
  getAdminClubHistory,
  saveSeasonSquad,
} from './api';
import type {
  ClubHistoryEntry,
  ClubHistorySeason,
  HistoryPlayer,
  SeasonSquadEntry,
  SeasonSquadInput,
} from './types';

const positionLabels = {
  DEF: 'Defender',
  FWD: 'Attacker',
  GK: 'Goalkeeper',
  MID: 'Midfielder',
} as const;

type SquadDraft = Record<
  string,
  {
    included: boolean;
    isStarter: boolean;
    position: SeasonSquadInput[number]['position'];
  }
>;

function shortDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeZone: 'Europe/London',
  }).format(new Date(value));
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The season history could not be updated.';
}

function initialDraft(
  season: ClubHistorySeason,
  players: HistoryPlayer[],
): SquadDraft {
  const source =
    season.squadEntries.length > 0
      ? season.squadEntries
      : season.suggestedSquad;
  return Object.fromEntries(
    players.map((player) => {
      const entry = source.find(
        (candidate) => candidate.playerId === player.id,
      );
      return [
        player.id,
        {
          included: Boolean(entry),
          isStarter: entry?.isStarter ?? false,
          position: entry?.position ?? player.position ?? 'DEF',
        },
      ];
    }),
  );
}

function SeasonSquadManager({
  onFinalised,
  onSquadSaved,
  players,
  season,
}: {
  onFinalised: (history: ClubHistoryEntry) => void;
  onSquadSaved: (entries: SeasonSquadEntry[]) => void;
  players: HistoryPlayer[];
  season: ClubHistorySeason;
}) {
  const [draft, setDraft] = useState<SquadDraft>(() =>
    initialDraft(season, players),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isFinalising, setIsFinalising] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function updatePlayer(playerId: string, values: Partial<SquadDraft[string]>) {
    setDraft((current) => ({
      ...current,
      [playerId]: { ...current[playerId]!, ...values },
    }));
  }

  function entriesFromDraft(): SeasonSquadInput {
    return players
      .filter((player) => draft[player.id]?.included)
      .map((player) => ({
        isStarter: draft[player.id]!.isStarter,
        playerId: player.id,
        position: draft[player.id]!.position,
      }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const entries = await saveSeasonSquad(season.id, entriesFromDraft());
      onSquadSaved(entries);
      setSuccess('Season formation saved.');
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFinalise() {
    setIsFinalising(true);
    setError(null);
    setSuccess(null);
    try {
      onFinalised(await finaliseClubHistory(season.id));
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setIsFinalising(false);
    }
  }

  return (
    <form className="season-squad-form" onSubmit={handleSave}>
      <div className="section-heading section-heading-compact">
        <p className="eyebrow">
          {season.tracksGamesPlayed
            ? 'Suggested from appearances'
            : 'Administrator selection required'}
        </p>
        <h3>{season.name} formation</h3>
        <p>
          Save exactly one goalkeeper, three defenders, one midfielder and one
          attacker as starters. Every other selected player appears on the
          season bench.
        </p>
      </div>

      <div className="season-squad-player-list">
        {players.map((player) => {
          const values = draft[player.id]!;
          return (
            <fieldset className="season-squad-player" key={player.id}>
              <label className="checkbox-label season-squad-player-name">
                <input
                  checked={values.included}
                  type="checkbox"
                  onChange={(event) =>
                    updatePlayer(player.id, { included: event.target.checked })
                  }
                />
                {player.name}
                {!player.isActiveSquad && ' · historical'}
              </label>
              <label>
                Role
                <select
                  disabled={!values.included}
                  value={values.isStarter ? 'starter' : 'bench'}
                  onChange={(event) =>
                    updatePlayer(player.id, {
                      isStarter: event.target.value === 'starter',
                    })
                  }
                >
                  <option value="starter">Starter</option>
                  <option value="bench">Bench</option>
                </select>
              </label>
              <label>
                Position
                <select
                  disabled={!values.included}
                  value={values.position}
                  onChange={(event) =>
                    updatePlayer(player.id, {
                      position: event.target
                        .value as SeasonSquadInput[number]['position'],
                    })
                  }
                >
                  {Object.entries(positionLabels).map(([position, label]) => (
                    <option key={position} value={position}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          );
        })}
      </div>

      {success && (
        <p className="form-success" role="status">
          {success}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="season-history-actions">
        <button className="primary-button" disabled={isSaving} type="submit">
          {isSaving ? 'Saving…' : 'Save season formation'}
        </button>
        <button
          className="secondary-button"
          disabled={
            isFinalising ||
            !season.canFinalise ||
            !season.standing ||
            season.squadEntries.length === 0
          }
          type="button"
          onClick={() => void handleFinalise()}
        >
          {isFinalising ? 'Finalising…' : 'Finalise season history'}
        </button>
      </div>
      {!season.canFinalise && (
        <p className="field-hint">
          This season ends on {shortDate(season.endDate)} and cannot be
          finalised yet.
        </p>
      )}
      {season.canFinalise && !season.standing && (
        <p className="field-hint">
          Refresh or enter the final league table before finalising.
        </p>
      )}
    </form>
  );
}

function ClubHistoryManager() {
  const [seasons, setSeasons] = useState<ClubHistorySeason[]>([]);
  const [players, setPlayers] = useState<HistoryPlayer[]>([]);
  const [history, setHistory] = useState<ClubHistoryEntry[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState('');
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );

  useEffect(() => {
    let isCurrentRequest = true;
    void getAdminClubHistory()
      .then((result) => {
        if (!isCurrentRequest) return;
        setSeasons(result.seasons);
        setPlayers(result.players);
        setHistory(result.history);
        setSelectedSeasonId(result.seasons[0]?.id ?? '');
        setLoadStatus('ready');
      })
      .catch(() => {
        if (isCurrentRequest) setLoadStatus('error');
      });
    return () => {
      isCurrentRequest = false;
    };
  }, []);

  const selectedSeason = seasons.find(
    (season) => season.id === selectedSeasonId,
  );

  function handleSquadSaved(entries: SeasonSquadEntry[]) {
    setSeasons((current) =>
      current.map((season) =>
        season.id === selectedSeasonId
          ? { ...season, squadEntries: entries, suggestedSquad: [] }
          : season,
      ),
    );
  }

  function handleFinalised(entry: ClubHistoryEntry) {
    const remaining = seasons.filter((season) => season.id !== entry.season.id);
    setSeasons(remaining);
    setSelectedSeasonId(remaining[0]?.id ?? '');
    setHistory((current) => [entry, ...current]);
  }

  return (
    <section className="club-history-admin-page">
      <div className="section-heading">
        <p className="eyebrow">Administrator</p>
        <h2>Build season history</h2>
        <p>
          Confirm each season’s representative formation and bench before its
          final league record becomes permanent.
        </p>
      </div>

      {loadStatus === 'loading' && (
        <p className="status-panel">Loading season history…</p>
      )}
      {loadStatus === 'error' && (
        <p className="status-panel status-panel-error" role="alert">
          Club history could not be loaded.
        </p>
      )}
      {loadStatus === 'ready' && seasons.length === 0 && (
        <p className="status-panel">
          No seasons are waiting for a formation or finalisation.
        </p>
      )}
      {loadStatus === 'ready' && selectedSeason && (
        <>
          <label className="history-season-select">
            Season
            <select
              value={selectedSeasonId}
              onChange={(event) => setSelectedSeasonId(event.target.value)}
            >
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                  {season.isCurrent ? ' · current' : ''}
                </option>
              ))}
            </select>
          </label>
          <SeasonSquadManager
            key={selectedSeason.id}
            players={players}
            season={selectedSeason}
            onFinalised={handleFinalised}
            onSquadSaved={handleSquadSaved}
          />
        </>
      )}

      <div className="history-finalised-section">
        <div className="section-heading section-heading-compact">
          <p className="eyebrow">Permanent record</p>
          <h3>Finalised seasons</h3>
        </div>
        {history.length === 0 ? (
          <p className="status-panel">No seasons have been finalised.</p>
        ) : (
          <div className="history-finalisation-list">
            {history.map((entry) => (
              <article className="history-finalisation-card" key={entry.id}>
                <div>
                  <p className="position-label">Final league position</p>
                  <h3>{entry.season.name}</h3>
                </div>
                <strong>{entry.position}</strong>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function AdminClubHistoryPage() {
  const { status, user } = useAuth();
  if (status === 'loading') {
    return <p className="status-panel">Checking your session…</p>;
  }
  if (status === 'anonymous') return <AuthScreen />;
  if (user?.role !== 'ADMIN') {
    return (
      <p className="status-panel status-panel-error">
        Administrator access is required.
      </p>
    );
  }
  return (
    <>
      <AdminNavigation />
      <ClubHistoryManager />
    </>
  );
}
