import { useMemo, useState, type FormEvent } from 'react';

import { saveAdminFixtureSquad } from './api';
import type {
  AdminFixtureAvailability,
  AdminSquadPlayer,
  FixtureSquad,
  SquadPosition,
} from './types';

type StarterSlot = {
  key: string;
  label: string;
  position: SquadPosition;
};

const starterSlots: StarterSlot[] = [
  { key: 'gk', label: 'Goalkeeper', position: 'GK' },
  { key: 'def-1', label: 'Defender 1', position: 'DEF' },
  { key: 'def-2', label: 'Defender 2', position: 'DEF' },
  { key: 'def-3', label: 'Defender 3', position: 'DEF' },
  { key: 'mid', label: 'Midfielder', position: 'MID' },
  { key: 'fwd', label: 'Attacker', position: 'FWD' },
];

function initialSelection(squad: FixtureSquad): {
  bench: Set<string>;
  starters: Record<string, string>;
} {
  const starters: Record<string, string> = {};
  const entriesByPosition = new Map<SquadPosition, string[]>();

  for (const entry of squad.squadEntries) {
    if (entry.isStarter && entry.position) {
      const current = entriesByPosition.get(entry.position) ?? [];
      current.push(entry.player.id);
      entriesByPosition.set(entry.position, current);
    }
  }

  const positionIndexes = new Map<SquadPosition, number>();
  for (const slot of starterSlots) {
    const index = positionIndexes.get(slot.position) ?? 0;
    starters[slot.key] = entriesByPosition.get(slot.position)?.[index] ?? '';
    positionIndexes.set(slot.position, index + 1);
  }

  return {
    bench: new Set(
      squad.squadEntries
        .filter((entry) => !entry.isStarter)
        .map((entry) => entry.player.id),
    ),
    starters,
  };
}

function responseLabel(
  roster: AdminFixtureAvailability | undefined,
  playerId: string,
): string {
  const response = roster?.availability.find(
    (entry) => entry.player.id === playerId,
  )?.response;
  if (response === 'AVAILABLE') return 'Available';
  if (response === 'UNSURE') return 'Unsure';
  if (response === 'UNAVAILABLE') return 'Unavailable';
  return 'No response';
}

type FixtureSquadEditorProps = {
  fixtureId: string;
  opponentName: string;
  players: AdminSquadPlayer[];
  roster: AdminFixtureAvailability | undefined;
  squad: FixtureSquad;
  onSaved: (squad: FixtureSquad) => void;
};

export function FixtureSquadEditor({
  fixtureId,
  onSaved,
  opponentName,
  players,
  roster,
  squad,
}: FixtureSquadEditorProps) {
  const [selection, setSelection] = useState(() => initialSelection(squad));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedStarterIds = useMemo(
    () => new Set(Object.values(selection.starters).filter(Boolean)),
    [selection.starters],
  );

  async function saveSquad(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const starters = starterSlots.map((slot) => ({
      isStarter: true,
      playerId: selection.starters[slot.key] ?? '',
      position: slot.position,
    }));
    if (starters.some((entry) => !entry.playerId)) {
      setError('Select all six starting positions before saving.');
      setSuccess(null);
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSaving(true);
    try {
      const saved = await saveAdminFixtureSquad(fixtureId, {
        entries: [
          ...starters,
          ...[...selection.bench].map((playerId) => ({
            isStarter: false,
            playerId,
            position: null,
          })),
        ],
      });
      onSaved(saved);
      setSuccess('Matchday squad saved.');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'The matchday squad could not be saved.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <details className="admin-fixture-squad">
      <summary>
        Matchday squad
        {squad.squadEntries.length > 0
          ? ` · ${squad.squadEntries.length} selected`
          : ' · Not selected'}
      </summary>
      <form onSubmit={saveSquad}>
        <p className="admin-item-detail">
          Select the 1–3–1–1 starting six and any substitutes for {opponentName}
          . Availability is shown as guidance.
        </p>
        <div className="fixture-squad-starters">
          {starterSlots.map((slot) => (
            <label key={slot.key}>
              {slot.label}
              <select
                aria-label={`${slot.label} against ${opponentName}`}
                value={selection.starters[slot.key] ?? ''}
                onChange={(event) => {
                  const playerId = event.target.value;
                  setSelection((current) => ({
                    bench: new Set(
                      [...current.bench].filter((id) => id !== playerId),
                    ),
                    starters: {
                      ...current.starters,
                      [slot.key]: playerId,
                    },
                  }));
                  setError(null);
                  setSuccess(null);
                }}
              >
                <option value="">Select a player</option>
                {players
                  .filter(
                    (player) =>
                      player.position === slot.position ||
                      player.additionalPositions.includes(slot.position),
                  )
                  .map((player) => {
                    const selectedElsewhere =
                      selectedStarterIds.has(player.id) &&
                      selection.starters[slot.key] !== player.id;
                    return (
                      <option
                        disabled={selectedElsewhere}
                        key={player.id}
                        value={player.id}
                      >
                        {player.name} · {responseLabel(roster, player.id)}
                      </option>
                    );
                  })}
              </select>
            </label>
          ))}
        </div>

        <fieldset className="fixture-squad-bench">
          <legend>Bench</legend>
          <div>
            {players.map((player) => (
              <label key={player.id}>
                <input
                  checked={selection.bench.has(player.id)}
                  disabled={selectedStarterIds.has(player.id)}
                  type="checkbox"
                  onChange={(event) => {
                    setSelection((current) => {
                      const bench = new Set(current.bench);
                      if (event.target.checked) bench.add(player.id);
                      else bench.delete(player.id);
                      return { ...current, bench };
                    });
                    setError(null);
                    setSuccess(null);
                  }}
                />
                <span>
                  {player.name} · {responseLabel(roster, player.id)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="form-success" role="status">
            {success}
          </p>
        )}
        <button className="primary-button" disabled={isSaving} type="submit">
          {isSaving ? 'Saving squad…' : 'Save matchday squad'}
        </button>
      </form>
    </details>
  );
}
