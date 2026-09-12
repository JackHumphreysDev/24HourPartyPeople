import request from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const imageMocks = vi.hoisted(() => ({
  deletePlayerImage: vi.fn<(publicId: string) => Promise<void>>(),
  uploadPlayerImage:
    vi.fn<(contents: Buffer) => Promise<{ publicId: string; url: string }>>(),
}));

vi.mock('../src/media/playerImage.js', () => ({
  deletePlayerImage: imageMocks.deletePlayerImage,
  ImageStorageConfigurationError: class extends Error {},
  uploadPlayerImage: imageMocks.uploadPlayerImage,
}));

import { createApp } from '../src/app.js';
import { createSession, SESSION_COOKIE_NAME } from '../src/auth/session.js';
import { prisma } from '../src/lib/prisma.js';

async function clearDatabase() {
  await prisma.scrapeStatus.deleteMany();
  await prisma.session.deleteMany();
  await prisma.gameResult.deleteMany();
  await prisma.fixture.deleteMany();
  await prisma.playerSeasonStat.deleteMany();
  await prisma.seasonStanding.deleteMany();
  await prisma.clubHistory.deleteMany();
  await prisma.seasonSquadEntry.deleteMany();
  await prisma.user.deleteMany();
  await prisma.player.deleteMany();
  await prisma.opponentClub.deleteMany();
  await prisma.season.deleteMany();
}

async function createUserSession(role: 'ADMIN' | 'PLAYER') {
  const user = await prisma.user.create({
    data: {
      email: `${role.toLowerCase()}@example.test`,
      name: `Test ${role}`,
      passwordHash: 'not-used-by-this-test',
      role,
    },
  });
  const token = await createSession(user.id);
  return `${SESSION_COOKIE_NAME}=${token}`;
}

function validPlayerFields() {
  return {
    additionalPositions: JSON.stringify(['MID', 'FWD']),
    description: 'A dependable defender with an eye for a pass.',
    isActiveSquad: 'true',
    isOnBench: 'false',
    name: 'Alex Example',
    position: 'DEF',
  };
}

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  await clearDatabase();
  imageMocks.deletePlayerImage.mockReset();
  imageMocks.deletePlayerImage.mockResolvedValue();
  imageMocks.uploadPlayerImage.mockReset();
  imageMocks.uploadPlayerImage.mockResolvedValue({
    publicId: '24-hour-party-people/players/test-image',
    url: 'https://res.cloudinary.com/example/image/upload/test.webp',
  });
});

afterEach(clearDatabase);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('public player API', () => {
  it('returns empty leaderboards when no season statistics exist', async () => {
    const response = await request(createApp()).get('/api/players/statistics');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      leaderboards: [
        { assists: [], cleanSheets: [], goals: [], seasonId: null },
      ],
      seasons: [],
    });
  });

  it('ranks current and historical players using saved and tracked game totals', async () => {
    const [active, historical, withoutStats] = await Promise.all([
      prisma.player.create({
        data: { description: 'Active.', name: 'Alex', position: 'MID' },
      }),
      prisma.player.create({
        data: {
          description: 'Historical.',
          isActiveSquad: false,
          name: 'Ben',
          position: null,
        },
      }),
      prisma.player.create({
        data: { description: 'No stats.', name: 'Charlie', position: 'DEF' },
      }),
    ]);
    const previous = await prisma.season.create({
      data: {
        endDate: new Date('2026-05-31T00:00:00.000Z'),
        name: 'Spring 2026',
        startDate: new Date('2026-03-01T00:00:00.000Z'),
      },
    });
    const current = await prisma.season.create({
      data: {
        endDate: new Date('2026-09-01T00:00:00.000Z'),
        isCurrent: true,
        name: 'Summer 2026',
        startDate: new Date('2026-06-01T00:00:00.000Z'),
        tracksGamesPlayed: true,
      },
    });
    await prisma.playerSeasonStat.createMany({
      data: [
        {
          assists: 1,
          cleanSheets: 2,
          goals: 3,
          playerId: active.id,
          seasonId: previous.id,
        },
        {
          assists: 2,
          cleanSheets: 0,
          goals: 3,
          playerId: historical.id,
          seasonId: previous.id,
        },
        {
          assists: 99,
          cleanSheets: 99,
          goals: 99,
          playerId: active.id,
          seasonId: current.id,
        },
        {
          assists: 0,
          cleanSheets: 0,
          goals: 0,
          playerId: withoutStats.id,
          seasonId: previous.id,
        },
      ],
    });
    const opponent = await prisma.opponentClub.create({
      data: { name: 'Rivals' },
    });
    await prisma.gameResult.create({
      data: {
        competition: 'LEAGUE',
        datePlayed: new Date('2026-07-01T00:00:00.000Z'),
        opponentClubId: opponent.id,
        opponentScore: 0,
        ourScore: 5,
        playerStats: {
          create: [
            { assists: 1, cleanSheet: true, goals: 2, playerId: active.id },
            {
              assists: 1,
              cleanSheet: true,
              goals: 3,
              playerId: historical.id,
            },
          ],
        },
        seasonId: current.id,
      },
    });
    await prisma.gameResult.create({
      data: {
        competition: 'LEAGUE',
        datePlayed: new Date('2026-07-08T00:00:00.000Z'),
        opponentClubId: opponent.id,
        opponentScore: 1,
        ourScore: 1,
        playerStats: {
          create: {
            assists: 0,
            cleanSheet: false,
            goals: 1,
            playerId: active.id,
          },
        },
        seasonId: current.id,
      },
    });

    const response = await request(createApp()).get('/api/players/statistics');

    expect(response.status).toBe(200);
    expect(response.body.seasons).toMatchObject([
      { id: current.id, isCurrent: true, name: 'Summer 2026' },
      { id: previous.id, isCurrent: false, name: 'Spring 2026' },
    ]);
    const allTime = response.body.leaderboards[0];
    expect(allTime.seasonId).toBeNull();
    expect(allTime.goals).toMatchObject([
      { name: 'Alex', playerId: active.id, rank: 1, value: 6 },
      {
        isActiveSquad: false,
        name: 'Ben',
        playerId: historical.id,
        rank: 1,
        value: 6,
      },
    ]);
    expect(allTime.assists).toMatchObject([
      { name: 'Ben', rank: 1, value: 3 },
      { name: 'Alex', rank: 2, value: 2 },
    ]);
    expect(allTime.cleanSheets).toMatchObject([
      { name: 'Alex', value: 3 },
      { name: 'Ben', value: 1 },
    ]);
    expect(allTime.goals).toHaveLength(2);
    expect(response.body.leaderboards[1]).toMatchObject({
      goals: [
        { name: 'Alex', rank: 1, value: 3 },
        { name: 'Ben', rank: 1, value: 3 },
      ],
      seasonId: current.id,
    });
    expect(response.body.leaderboards[2]).toMatchObject({
      cleanSheets: [{ name: 'Alex', value: 2 }],
      seasonId: previous.id,
    });
  });

  it('lists active players without exposing image storage identifiers', async () => {
    await prisma.player.createMany({
      data: [
        {
          description: 'Active squad member.',
          name: 'Active Player',
          position: 'MID',
          profilePicturePublicId: 'private/cloudinary-id',
          profilePictureUrl: 'https://example.test/active.webp',
        },
        {
          description: 'Former squad member.',
          isActiveSquad: false,
          name: 'Inactive Player',
          position: 'FWD',
        },
      ],
    });

    const response = await request(createApp()).get('/api/players');

    expect(response.status).toBe(200);
    expect(response.body.players).toHaveLength(1);
    expect(response.body.historicalPlayers).toHaveLength(1);
    expect(response.body.players[0]).toMatchObject({
      additionalPositions: [],
      isActiveSquad: true,
      isOnBench: false,
      name: 'Active Player',
      position: 'MID',
      profilePictureUrl: 'https://example.test/active.webp',
    });
    expect(response.body.players[0]).not.toHaveProperty(
      'profilePicturePublicId',
    );
    expect(response.body.historicalPlayers[0]).toMatchObject({
      isActiveSquad: false,
      name: 'Inactive Player',
    });
    expect(response.body.historicalPlayers[0]).not.toHaveProperty(
      'profilePicturePublicId',
    );
  });

  it('returns current and historic season statistics for an active player', async () => {
    const player = await prisma.player.create({
      data: {
        description: 'Player profile detail test.',
        name: 'Profile Player',
        position: 'GK',
      },
    });
    const previousSeason = await prisma.season.create({
      data: {
        endDate: new Date('2026-05-31T00:00:00.000Z'),
        name: 'Spring 2026',
        startDate: new Date('2026-03-01T00:00:00.000Z'),
      },
    });
    const currentSeason = await prisma.season.create({
      data: {
        endDate: new Date('2026-09-01T00:00:00.000Z'),
        isCurrent: true,
        name: 'Summer 2026',
        startDate: new Date('2026-06-01T00:00:00.000Z'),
        tracksGamesPlayed: true,
      },
    });
    await prisma.playerSeasonStat.create({
      data: {
        assists: 1,
        cleanSheets: 2,
        gamesPlayed: null,
        goals: 3,
        playerId: player.id,
        seasonId: previousSeason.id,
      },
    });
    const opponent = await prisma.opponentClub.create({
      data: { name: 'Profile Opponent' },
    });
    for (const [datePlayed, goals, assists, cleanSheet] of [
      ['2026-07-01', 1, 2, true],
      ['2026-07-08', 2, 0, false],
    ] as const) {
      await prisma.gameResult.create({
        data: {
          competition: 'LEAGUE',
          datePlayed: new Date(`${datePlayed}T00:00:00.000Z`),
          opponentClubId: opponent.id,
          opponentScore: cleanSheet ? 0 : 1,
          ourScore: 3,
          playerStats: {
            create: { assists, cleanSheet, goals, playerId: player.id },
          },
          seasonId: currentSeason.id,
        },
      });
    }

    const response = await request(createApp()).get(
      `/api/players/${player.id}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.player.seasonStats).toHaveLength(2);
    expect(response.body.player.seasonStats[0]).toMatchObject({
      assists: 2,
      cleanSheets: 1,
      gamesPlayed: 2,
      goals: 3,
      season: { isCurrent: true, name: 'Summer 2026' },
    });
    expect(response.body.player.seasonStats[1]).toMatchObject({
      gamesPlayed: null,
      season: { isCurrent: false, name: 'Spring 2026' },
    });
  });

  it('returns inactive historical profiles and rejects malformed profile IDs', async () => {
    const inactivePlayer = await prisma.player.create({
      data: {
        description: 'Not in the current squad.',
        isActiveSquad: false,
        name: 'Inactive Player',
        position: 'FWD',
      },
    });

    const historicalProfile = await request(createApp()).get(
      `/api/players/${inactivePlayer.id}`,
    );
    expect(historicalProfile.status).toBe(200);
    expect(historicalProfile.body.player).toMatchObject({
      isActiveSquad: false,
      name: 'Inactive Player',
    });
    expect(
      (await request(createApp()).get('/api/players/not-a-uuid')).status,
    ).toBe(404);
  });
});

describe('administrator player API', () => {
  it('requires an authenticated administrator', async () => {
    const app = createApp();
    const anonymous = await request(app)
      .post('/api/admin/players')
      .field(validPlayerFields());
    expect(anonymous.status).toBe(401);

    const playerCookie = await createUserSession('PLAYER');
    const forbidden = await request(app)
      .post('/api/admin/players')
      .set('Cookie', playerCookie)
      .field(validPlayerFields());
    expect(forbidden.status).toBe(403);
  });

  it('creates a player and stores a validated uploaded image', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const response = await request(createApp())
      .post('/api/admin/players')
      .set('Cookie', adminCookie)
      .field(validPlayerFields())
      .attach('profilePicture', Buffer.from('test-image'), {
        contentType: 'image/png',
        filename: 'player.png',
      });

    expect(response.status).toBe(201);
    expect(response.body.player).toMatchObject({
      additionalPositions: ['MID', 'FWD'],
      isActiveSquad: true,
      isOnBench: false,
      name: 'Alex Example',
      position: 'DEF',
      profilePictureUrl:
        'https://res.cloudinary.com/example/image/upload/test.webp',
    });
    expect(response.body.player).not.toHaveProperty('profilePicturePublicId');
    expect(imageMocks.uploadPlayerImage).toHaveBeenCalledOnce();

    await expect(
      prisma.player.findUniqueOrThrow({
        where: { id: response.body.player.id },
      }),
    ).resolves.toMatchObject({
      additionalPositions: ['MID', 'FWD'],
      profilePicturePublicId: '24-hour-party-people/players/test-image',
    });
  });

  it('allows unknown positions only for inactive historical players', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const app = createApp();
    const historicalFields = {
      additionalPositions: '[]',
      description: 'Imported historical player.',
      isActiveSquad: 'false',
      name: 'Historical Player',
      position: '',
    };
    const historical = await request(app)
      .post('/api/admin/players')
      .set('Cookie', adminCookie)
      .field(historicalFields);
    const activeWithoutPosition = await request(app)
      .post('/api/admin/players')
      .set('Cookie', adminCookie)
      .field({
        ...historicalFields,
        isActiveSquad: 'true',
        name: 'Invalid Active Player',
      });

    expect(historical.status).toBe(201);
    expect(historical.body.player).toMatchObject({
      isActiveSquad: false,
      position: null,
    });
    expect(activeWithoutPosition.status).toBe(400);
  });

  it('rejects duplicate additional positions and the primary position', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const app = createApp();

    const duplicate = await request(app)
      .post('/api/admin/players')
      .set('Cookie', adminCookie)
      .field({
        ...validPlayerFields(),
        additionalPositions: JSON.stringify(['MID', 'MID']),
      });
    expect(duplicate.status).toBe(400);

    const includesPrimary = await request(app)
      .post('/api/admin/players')
      .set('Cookie', adminCookie)
      .field({
        ...validPlayerFields(),
        additionalPositions: JSON.stringify(['DEF']),
      });
    expect(includesPrimary.status).toBe(400);
    expect(await prisma.player.count()).toBe(0);
  });

  it('rejects unsupported uploads before contacting image storage', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const response = await request(createApp())
      .post('/api/admin/players')
      .set('Cookie', adminCookie)
      .field(validPlayerFields())
      .attach('profilePicture', Buffer.from('plain text'), {
        contentType: 'text/plain',
        filename: 'player.txt',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('UNSUPPORTED_IMAGE_TYPE');
    expect(imageMocks.uploadPlayerImage).not.toHaveBeenCalled();
    await expect(prisma.player.count()).resolves.toBe(0);
  });

  it('rejects images larger than the five-megabyte limit', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const response = await request(createApp())
      .post('/api/admin/players')
      .set('Cookie', adminCookie)
      .field(validPlayerFields())
      .attach('profilePicture', Buffer.alloc(5 * 1024 * 1024 + 1), {
        contentType: 'image/jpeg',
        filename: 'too-large.jpg',
      });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('IMAGE_TOO_LARGE');
    expect(imageMocks.uploadPlayerImage).not.toHaveBeenCalled();
    await expect(prisma.player.count()).resolves.toBe(0);
  });

  it('enforces the confirmed active formation limits', async () => {
    const adminCookie = await createUserSession('ADMIN');
    await prisma.player.create({
      data: {
        description: 'The active goalkeeper.',
        name: 'Starting Keeper',
        position: 'GK',
      },
    });

    const response = await request(createApp())
      .post('/api/admin/players')
      .set('Cookie', adminCookie)
      .field({ ...validPlayerFields(), position: 'GK' })
      .attach('profilePicture', Buffer.from('test-image'), {
        contentType: 'image/png',
        filename: 'keeper.png',
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('FORMATION_POSITION_FULL');
    expect(imageMocks.deletePlayerImage).toHaveBeenCalledWith(
      '24-hour-party-people/players/test-image',
    );
    await expect(
      prisma.player.count({ where: { position: 'GK' } }),
    ).resolves.toBe(1);
  });

  it('allows substitutes beyond the starting formation limits', async () => {
    const adminCookie = await createUserSession('ADMIN');
    await prisma.player.create({
      data: {
        description: 'The starting goalkeeper.',
        name: 'Starting Keeper',
        position: 'GK',
      },
    });

    const response = await request(createApp())
      .post('/api/admin/players')
      .set('Cookie', adminCookie)
      .field({ ...validPlayerFields(), isOnBench: 'true', position: 'GK' });

    expect(response.status).toBe(201);
    expect(response.body.player).toMatchObject({
      isActiveSquad: true,
      isOnBench: true,
      position: 'GK',
    });
    await expect(
      prisma.player.count({ where: { isOnBench: true, position: 'GK' } }),
    ).resolves.toBe(1);
  });

  it('rejects bench status for an inactive historical player', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const response = await request(createApp())
      .post('/api/admin/players')
      .set('Cookie', adminCookie)
      .field({
        ...validPlayerFields(),
        isActiveSquad: 'false',
        isOnBench: 'true',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_PLAYER');
    await expect(prisma.player.count()).resolves.toBe(0);
  });

  it('updates squad status and safely replaces a managed image', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const player = await prisma.player.create({
      data: {
        description: 'Original description.',
        name: 'Original Name',
        position: 'MID',
        profilePicturePublicId: '24-hour-party-people/players/old-image',
        profilePictureUrl: 'https://example.test/old.webp',
      },
    });

    const response = await request(createApp())
      .put(`/api/admin/players/${player.id}`)
      .set('Cookie', adminCookie)
      .field({
        ...validPlayerFields(),
        isActiveSquad: 'false',
        name: 'Updated Name',
        removeProfilePicture: 'false',
      })
      .attach('profilePicture', Buffer.from('replacement-image'), {
        contentType: 'image/webp',
        filename: 'replacement.webp',
      });

    expect(response.status).toBe(200);
    expect(response.body.player).toMatchObject({
      isActiveSquad: false,
      name: 'Updated Name',
      profilePictureUrl:
        'https://res.cloudinary.com/example/image/upload/test.webp',
    });
    expect(imageMocks.deletePlayerImage).toHaveBeenCalledWith(
      '24-hour-party-people/players/old-image',
    );
  });

  it('removes an existing managed image without deleting the player', async () => {
    const adminCookie = await createUserSession('ADMIN');
    const player = await prisma.player.create({
      data: {
        description: 'Player with a removable picture.',
        name: 'Picture Player',
        position: 'FWD',
        profilePicturePublicId: '24-hour-party-people/players/remove-me',
        profilePictureUrl: 'https://example.test/remove-me.webp',
      },
    });

    const response = await request(createApp())
      .put(`/api/admin/players/${player.id}`)
      .set('Cookie', adminCookie)
      .field({
        description: player.description,
        isActiveSquad: 'true',
        name: player.name,
        position: player.position!,
        removeProfilePicture: 'true',
      });

    expect(response.status).toBe(200);
    expect(response.body.player.profilePictureUrl).toBeNull();
    expect(imageMocks.deletePlayerImage).toHaveBeenCalledWith(
      '24-hour-party-people/players/remove-me',
    );
    await expect(
      prisma.player.findUniqueOrThrow({ where: { id: player.id } }),
    ).resolves.toMatchObject({
      id: player.id,
      profilePicturePublicId: null,
      profilePictureUrl: null,
    });
  });
});
