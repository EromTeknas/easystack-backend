import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, redisClient } from '../../src/db';
import mongoose from 'mongoose';
import { FeedService } from '../../src/services/feed.service';

after(async () => {
  await prisma.$disconnect();
  redisClient.quit();
  await mongoose.disconnect();
});

test('Nested Resource IDOR Protection (Feeds)', async (t) => {
  const user = await prisma.user.create({
    data: {
      email: `idor-user-${Date.now()}@example.com`,
      firstName: 'IDOR',
      lastName: 'User',
      resourceId: `usr_idor_${Date.now()}`
    }
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: `Workspace IDOR`,
      slug: `ws-idor-${Date.now()}`,
      createdById: user.id,
      resourceId: `ws_idor_${Date.now()}`
    }
  });

  // Project A (Belongs to User)
  const projectA = await prisma.project.create({
    data: {
      name: 'Project A',
      slug: `proj-a-${Date.now()}`,
      workspaceId: workspace.id,
      createdById: user.id,
      resourceId: `proj_a_${Date.now()}`
    }
  });

  // Project B (Belongs to someone else, but we create it here for the test)
  const projectB = await prisma.project.create({
    data: {
      name: 'Project B',
      slug: `proj-b-${Date.now()}`,
      workspaceId: workspace.id,
      createdById: user.id,
      resourceId: `proj_b_${Date.now()}`
    }
  });

  // Feed in Project B
  const feedB = await prisma.feed.create({
    data: {
      name: 'Feed B',
      projectId: projectB.id,
      baseLanguage: 'en',
    }
  });

  // Test 1: getFeedDetail should fail when requesting Feed B under Project A
  await assert.rejects(
    FeedService.getFeedDetail(projectA.id, feedB.id),
    (err: any) => err.message === 'Feed not found',
    'getFeedDetail must enforce projectId matching'
  );

  // Test 2: getLocalizationStatuses should fail when requesting Feed B under Project A
  await assert.rejects(
    FeedService.getLocalizationStatuses(projectA.id, feedB.id),
    (err: any) => err.message === 'Feed not active in development environment' || err.message.includes('not found'),
    'getLocalizationStatuses must enforce projectId matching'
  );

  // Clean up
  await prisma.feed.delete({ where: { id: feedB.id } });
  await prisma.project.delete({ where: { id: projectA.id } });
  await prisma.project.delete({ where: { id: projectB.id } });
  await prisma.workspace.delete({ where: { id: workspace.id } });
  await prisma.user.delete({ where: { id: user.id } });
});
