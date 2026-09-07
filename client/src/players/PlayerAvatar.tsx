import type { PlayerSummary } from './types';

type PlayerAvatarProps = {
  player: Pick<PlayerSummary, 'name' | 'profilePictureUrl'>;
};

export function PlayerAvatar({ player }: PlayerAvatarProps) {
  if (player.profilePictureUrl) {
    return (
      <img
        className="player-avatar"
        src={player.profilePictureUrl}
        alt={`${player.name} profile`}
      />
    );
  }

  const initials = player.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <div className="player-avatar player-avatar-placeholder" aria-hidden="true">
      {initials || '?'}
    </div>
  );
}
