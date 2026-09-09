import { useEffect, useState, type FormEvent } from 'react';

import { AuthScreen } from '../AuthScreen';
import { AdminNavigation } from '../admin/AdminNavigation';
import { useAuth } from '../auth/useAuth';
import { createPlayer, getAdminPlayers, updatePlayer } from './api';
import { PlayerAvatar } from './PlayerAvatar';
import type { PlayerInput, PlayerPosition, PlayerSummary } from './types';
import { positionLabels } from './types';

const emptyInput: PlayerInput = {
  additionalPositions: [],
  description: '',
  image: null,
  isActiveSquad: true,
  isOnBench: false,
  name: '',
  position: 'DEF',
  removeProfilePicture: false,
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The request could not be completed.';
}

type PlayerFormProps = {
  editingPlayer: PlayerSummary | null;
  onCancel: () => void;
  onSaved: (player: PlayerSummary) => void;
};

function PlayerForm({ editingPlayer, onCancel, onSaved }: PlayerFormProps) {
  const [input, setInput] = useState<PlayerInput>(() =>
    editingPlayer
      ? {
          additionalPositions: editingPlayer.additionalPositions ?? [],
          description: editingPlayer.description,
          image: null,
          isActiveSquad: editingPlayer.isActiveSquad,
          isOnBench: editingPlayer.isOnBench,
          name: editingPlayer.name,
          position: editingPlayer.position,
          removeProfilePicture: false,
        }
      : emptyInput,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    setIsSubmitting(true);

    try {
      const player = editingPlayer
        ? await updatePlayer(editingPlayer.id, input)
        : await createPlayer(input);
      if (!editingPlayer) {
        setInput({ ...emptyInput });
        form.reset();
      }
      onSaved(player);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="admin-player-form" onSubmit={handleSubmit}>
      <div className="admin-form-heading">
        <div>
          <p className="eyebrow">
            {editingPlayer ? 'Update profile' : 'New profile'}
          </p>
          <h3>{editingPlayer ? editingPlayer.name : 'Add a player'}</h3>
        </div>
        {editingPlayer && (
          <button className="text-button" type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>

      <label>
        Name
        <input
          maxLength={100}
          required
          value={input.name}
          onChange={(event) => setInput({ ...input, name: event.target.value })}
        />
      </label>

      <label>
        Description
        <textarea
          maxLength={2000}
          required
          rows={5}
          value={input.description}
          onChange={(event) =>
            setInput({ ...input, description: event.target.value })
          }
        />
      </label>

      <label>
        Primary position
        <select
          required={input.isActiveSquad}
          value={input.position ?? ''}
          onChange={(event) => {
            const position = (event.target.value ||
              null) as PlayerPosition | null;
            setInput({
              ...input,
              additionalPositions: input.additionalPositions.filter(
                (additionalPosition) => additionalPosition !== position,
              ),
              position,
            });
          }}
        >
          <option value="">Unknown (historical player)</option>
          {Object.entries(positionLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="additional-positions-fieldset">
        <legend>Additional positions</legend>
        <p className="field-hint">
          Select every other position this player can cover. Formation placement
          continues to use the primary position.
        </p>
        <div className="checkbox-grid">
          {Object.entries(positionLabels).map(([value, label]) => {
            const position = value as PlayerPosition;
            if (position === input.position) return null;

            return (
              <label className="checkbox-label" key={position}>
                <input
                  checked={input.additionalPositions.includes(position)}
                  disabled={input.position === null}
                  type="checkbox"
                  onChange={(event) =>
                    setInput({
                      ...input,
                      additionalPositions: event.target.checked
                        ? [...input.additionalPositions, position]
                        : input.additionalPositions.filter(
                            (selectedPosition) => selectedPosition !== position,
                          ),
                    })
                  }
                />
                {label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <label>
        Profile picture
        <input
          accept="image/jpeg,image/png,image/webp"
          type="file"
          onChange={(event) =>
            setInput({ ...input, image: event.target.files?.[0] ?? null })
          }
        />
        <span className="field-hint">JPEG, PNG, or WebP; maximum 5 MB.</span>
      </label>

      {editingPlayer?.profilePictureUrl && (
        <label className="checkbox-label">
          <input
            checked={input.removeProfilePicture}
            type="checkbox"
            onChange={(event) =>
              setInput({
                ...input,
                removeProfilePicture: event.target.checked,
              })
            }
          />
          Remove the current picture
        </label>
      )}

      <label className="checkbox-label">
        <input
          checked={input.isActiveSquad}
          type="checkbox"
          onChange={(event) =>
            setInput({
              ...input,
              isActiveSquad: event.target.checked,
              isOnBench: event.target.checked ? input.isOnBench : false,
            })
          }
        />
        Show in the current squad
      </label>

      <label className="checkbox-label">
        <input
          checked={input.isOnBench}
          disabled={!input.isActiveSquad}
          type="checkbox"
          onChange={(event) =>
            setInput({ ...input, isOnBench: event.target.checked })
          }
        />
        Show as a substitute on the bench
      </label>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <button className="primary-button" disabled={isSubmitting} type="submit">
        {isSubmitting
          ? 'Saving…'
          : editingPlayer
            ? 'Save player'
            : 'Create player'}
      </button>
    </form>
  );
}

function PlayerManager() {
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [editingPlayer, setEditingPlayer] = useState<PlayerSummary | null>(
    null,
  );
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );

  useEffect(() => {
    let isCurrentRequest = true;

    void getAdminPlayers()
      .then((nextPlayers) => {
        if (isCurrentRequest) {
          setPlayers(nextPlayers);
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

  function handleSaved(savedPlayer: PlayerSummary) {
    setPlayers((currentPlayers) => {
      const existingIndex = currentPlayers.findIndex(
        (player) => player.id === savedPlayer.id,
      );
      if (existingIndex === -1) {
        return [...currentPlayers, savedPlayer];
      }

      return currentPlayers.map((player) =>
        player.id === savedPlayer.id ? savedPlayer : player,
      );
    });
    setEditingPlayer(null);
  }

  return (
    <section className="admin-layout">
      <div className="admin-player-list">
        <div className="section-heading section-heading-compact">
          <p className="eyebrow">Administrator</p>
          <h2>Manage players</h2>
          <p>Create profiles, update pictures, or change squad status.</p>
        </div>

        {status === 'loading' && (
          <p className="status-panel">Loading players…</p>
        )}
        {status === 'error' && (
          <p className="status-panel status-panel-error" role="alert">
            Players could not be loaded.
          </p>
        )}
        {status === 'ready' && players.length === 0 && (
          <p className="status-panel">No player profiles have been created.</p>
        )}

        <div className="admin-player-items">
          {players.map((player) => (
            <article className="admin-player-item" key={player.id}>
              <PlayerAvatar player={player} />
              <div>
                <p className="position-label">
                  Primary:{' '}
                  {player.position
                    ? positionLabels[player.position]
                    : 'Unknown (historical)'}
                  {(player.additionalPositions?.length ?? 0) > 0 && (
                    <>
                      {' '}
                      · Also:{' '}
                      {player.additionalPositions
                        .map((position) => positionLabels[position])
                        .join(', ')}
                    </>
                  )}{' '}
                  ·{' '}
                  {player.isActiveSquad
                    ? player.isOnBench
                      ? 'Active · Bench'
                      : 'Active · Starting six'
                    : 'Inactive'}
                </p>
                <h3>{player.name}</h3>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setEditingPlayer(player)}
              >
                Edit
              </button>
            </article>
          ))}
        </div>
      </div>

      <PlayerForm
        key={editingPlayer?.id ?? 'new-player'}
        editingPlayer={editingPlayer}
        onCancel={() => setEditingPlayer(null)}
        onSaved={handleSaved}
      />
    </section>
  );
}

export function AdminPlayersPage() {
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
      <AdminNavigation />
      <PlayerManager />
    </>
  );
}
