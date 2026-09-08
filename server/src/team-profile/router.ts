import { Router } from 'express';
import { z } from 'zod';

import { requireAdmin, requireAuthentication } from '../auth/middleware.js';
import { prisma } from '../lib/prisma.js';

const TEAM_PROFILE_ID = 1;
const teamProfileSchema = z.object({
  description: z.string().trim().min(1).max(2_000),
});

const teamProfileSelect = {
  description: true,
  updatedAt: true,
} as const;

async function getTeamProfile() {
  return prisma.teamProfile.findUniqueOrThrow({
    select: teamProfileSelect,
    where: { id: TEAM_PROFILE_ID },
  });
}

export const publicTeamProfileRouter = Router();

publicTeamProfileRouter.get('/', async (_request, response) => {
  response.status(200).json({ teamProfile: await getTeamProfile() });
});

export const adminTeamProfileRouter = Router();

adminTeamProfileRouter.use(requireAuthentication, requireAdmin);

adminTeamProfileRouter.get('/', async (_request, response) => {
  response.status(200).json({ teamProfile: await getTeamProfile() });
});

adminTeamProfileRouter.put('/', async (request, response) => {
  const parsed = teamProfileSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      error: {
        code: 'INVALID_TEAM_PROFILE',
        message: 'Enter a team description between 1 and 2,000 characters.',
      },
    });
    return;
  }

  const teamProfile = await prisma.teamProfile.upsert({
    create: { id: TEAM_PROFILE_ID, description: parsed.data.description },
    select: teamProfileSelect,
    update: { description: parsed.data.description },
    where: { id: TEAM_PROFILE_ID },
  });

  response.status(200).json({ teamProfile });
});
