import { z } from 'zod';

const TEAM_NAME = '24 Hour Party People';

const standingSchema = z
  .object({
    clubName: z.string().trim().min(1).max(100),
    drawn: z.int().min(0),
    ga: z.int().min(0),
    gd: z.int(),
    gf: z.int().min(0),
    lost: z.int().min(0),
    played: z.int().min(0),
    points: z.int().min(0),
    position: z.int().min(1),
    walkoverGames: z.int().min(0),
    won: z.int().min(0),
  })
  .refine((row) => row.played === row.won + row.drawn + row.lost)
  .refine((row) => row.gd === row.gf - row.ga)
  .refine((row) => row.walkoverGames <= row.played);

const fixtureSchema = z.object({
  competition: z.enum(['LEAGUE', 'CUP']),
  opponentClubName: z.string().trim().min(1).max(100),
  scheduledDate: z.iso.date(),
  scheduledTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  venue: z.string().trim().min(1).max(200).nullable(),
});

const resultSchema = z.object({
  competition: z.enum(['LEAGUE', 'CUP']),
  datePlayed: z.iso.date(),
  opponentClubName: z.string().trim().min(1).max(100),
  opponentScore: z.int().min(0),
  ourScore: z.int().min(0),
});

export const scrapePayloadSchema = z
  .object({
    fixtures: z.array(fixtureSchema).max(100),
    results: z.array(resultSchema).max(1000),
    scrapedAt: z.iso.datetime({ offset: true }),
    standings: z.array(standingSchema).min(1).max(100),
  })
  .superRefine(({ standings }, context) => {
    const positions = new Set<number>();
    const clubNames = new Set<string>();

    standings.forEach((row, index) => {
      const clubName = row.clubName.toLocaleLowerCase('en-GB');
      if (positions.has(row.position)) {
        context.addIssue({
          code: 'custom',
          message: 'Standings positions must be unique.',
          path: ['standings', index, 'position'],
        });
      }
      if (clubNames.has(clubName)) {
        context.addIssue({
          code: 'custom',
          message: 'Standings club names must be unique.',
          path: ['standings', index, 'clubName'],
        });
      }
      positions.add(row.position);
      clubNames.add(clubName);
    });

    if (!clubNames.has(TEAM_NAME.toLocaleLowerCase('en-GB'))) {
      context.addIssue({
        code: 'custom',
        message: `${TEAM_NAME} must be included in the standings.`,
        path: ['standings'],
      });
    }
  });

export type ScrapePayload = z.infer<typeof scrapePayloadSchema>;
