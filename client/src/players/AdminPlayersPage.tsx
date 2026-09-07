import { useEffect, useState, type FormEvent } from 'react';
import { NavLink } from 'react-router-dom';

import { AuthScreen } from '../AuthScreen';
import { useAuth } from '../auth/useAuth';
import { createPlayer, getAdminPlayers, updatePlayer } from './api';
import { PlayerAvatar } from './PlayerAvatar';
import type { PlayerInput, PlayerPosition, PlayerSummary } from './types';
import { positionLabels } from './types';

const emptyInput: PlayerInput = {
  description: '',
  image: null,
  isActiveSquad: true,
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
          description: editingPlayer.description,
          image: null,
          isActiveSquad: editingPlayer.isActiveSquad,
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
        Position
        <select
          value={input.position}
          onChange={(event) =>
            setInput({
              ...input,
              position: event.target.value as PlayerPosition,
            })
          }
        >
          {Object.entries(positionLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

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
            setInput({ ...input, isActiveSquad: event.target.checked })
          }
        />
        Show in the current squad
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
                  {positionLabels[player.position]} ·{' '}
                  {player.isActiveSquad ? 'Active' : 'Inactive'}
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
      <nav className="admin-nav" aria-label="Administrator sections">
        <NavLink to="/admin" end>
          Players
        </NavLink>
        <NavLink to="/admin/statistics">Seasons &amp; statistics</NavLink>
        <NavLink to="/admin/standings">Standings</NavLink>
        <NavLink to="/admin/fixtures">Fixtures</NavLink>
        <NavLink to="/admin/games">Results</NavLink>
      </nav>
      <PlayerManager />
    </>
  );
}
