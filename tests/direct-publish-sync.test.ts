import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { prisma, redisClient, connectMongo } from '../src/db';
import { SchemaBlueprint } from '../src/models/schema-blueprint.model';
import { ContentEntry } from '../src/models/content-entry.model';
import { ContentEntryService } from '../src/services/content-entry.service';
import { ProjectService } from '../src/services/project.service';

before(async () => {
  await connectMongo();
});

after(async () => {
  await prisma.$disconnect();
  redisClient.quit();
  await mongoose.disconnect();
});

test('P0-3 Direct Publish & Sync and P0-5 Project Summary', async () => {
  const timestamp = Date.now();

  // Create test user
  const user = await prisma.user.create({
    data: {
      email: `pub-sync-${timestamp}@example.com`,
      firstName: 'Publish',
      lastName: 'Sync',
      resourceId: `usr_pub_${timestamp}`,
    },
  });

  // Create workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: `WS Pub Sync ${timestamp}`,
      slug: `ws-pub-${timestamp}`,
      resourceId: `ws_pub_${timestamp}`,
      createdById: user.id,
    },
  });

  // Create project
  const project = await prisma.project.create({
    data: {
      name: 'Publish Sync Project',
      slug: `proj-pub-${timestamp}`,
      resourceId: `proj_pub_${timestamp}`,
      workspaceId: workspace.id,
      createdById: user.id,
      supportedLanguages: ['en', 'es'],
    },
  });

  // Create environments: dev (rank 10, isEditable: true) and sanket (rank 100, isEditable: false)
  const baseEnv = await prisma.environment.create({
    data: {
      projectId: project.id,
      name: 'dev',
      displayName: 'Development',
      rank: 10,
      isEditable: true,
    },
  });

  const liveEnv = await prisma.environment.create({
    data: {
      projectId: project.id,
      name: 'sanket',
      displayName: 'Sanket Production',
      rank: 100,
      isEditable: false,
    },
  });

  // Create Schema Blueprint
  const blueprintSlug = `articles-${timestamp}`;
  const blueprint = await SchemaBlueprint.create({
    projectId: project.id,
    name: 'Articles',
    slug: blueprintSlug,
    type: 'collection',
    createdBy: user.id,
    schemaDefinition: {
      version: 1,
      fields: [
        {
          id: 'fld-headline',
          key: 'headline',
          label: 'Headline',
          type: 'text',
          required: true,
          isLocalized: false,
        },
        {
          id: 'fld-body',
          key: 'body',
          label: 'Body',
          type: 'text',
          required: false,
          isLocalized: false,
        },
      ],
    },
  });

  try {
    // 1. Create a draft entry in base environment (dev)
    const entry = await ContentEntryService.createEntry(
      project.id,
      blueprintSlug,
      user.id,
      {
        title: 'New Article Headline',
        slug: 'new-article',
        status: 'draft',
        environmentId: baseEnv.id,
        content: {
          headline: 'New Article Headline',
          body: 'This is the draft body of the article',
        },
      }
    );

    assert.ok(entry._id);
    assert.equal(entry.status, 'draft');

    // 2. Publish and Sync directly to sanket environment (liveEnv.id)
    const publishResult = await ContentEntryService.publishEntry(
      project.id,
      blueprintSlug,
      entry._id.toString(),
      user.id,
      {
        targetEnv: baseEnv.id,
        forcePublish: false,
        syncToEnvIds: [liveEnv.id],
      }
    );

    assert.equal(publishResult.entry.status, 'published');
    assert.ok(publishResult.syncedEnvironments);
    assert.equal(publishResult.syncedEnvironments.length, 1);
    assert.equal(publishResult.syncedEnvironments[0]?.id, liveEnv.id);

    // 3. Verify base environment document is published
    const baseDoc = await ContentEntry.findOne({
      projectId: project.id,
      schemaSlug: blueprintSlug,
      slug: 'new-article',
      environmentId: baseEnv.id,
    });
    assert.ok(baseDoc);
    assert.equal(baseDoc.status, 'published');
    assert.deepEqual(baseDoc.publishedContent, {
      headline: 'New Article Headline',
      body: 'This is the draft body of the article',
    });

    // 4. Verify downstream target environment document exists and has environmentId: liveEnv.id
    const targetDoc = await ContentEntry.findOne({
      projectId: project.id,
      schemaSlug: blueprintSlug,
      slug: 'new-article',
      environmentId: liveEnv.id,
    });
    assert.ok(targetDoc, 'Target document should exist in downstream environment');
    assert.equal(targetDoc.environmentId, liveEnv.id);
    assert.equal(targetDoc.environment, 'sanket');
    assert.equal(targetDoc.status, 'published');
    assert.deepEqual(targetDoc.publishedContent, {
      headline: 'New Article Headline',
      body: 'This is the draft body of the article',
    });

    // 5. Test syncSingleEntry directly
    const syncResult = await ContentEntryService.syncSingleEntry(
      project.id,
      blueprintSlug,
      baseDoc._id.toString(),
      user.id,
      {
        sourceEnvId: baseEnv.id,
        targetEnvIds: [liveEnv.id],
      }
    );
    assert.equal(syncResult.syncedEnvironments.length, 1);
    assert.equal(syncResult.syncedEnvironments[0]?.id, liveEnv.id);

    // 6. Test getProjectSummary
    const summary = await ProjectService.getProjectSummary(project.id, baseEnv.id);
    assert.equal(summary.project.id, project.id);
    assert.equal(summary.environments.list.length, 2);
    assert.ok(summary.environments.base);
    assert.equal(summary.environments.base.id, baseEnv.id);
    assert.ok(summary.environments.terminal);
    assert.equal(summary.environments.terminal.id, liveEnv.id);
    assert.ok(summary.metrics.blueprints.total >= 1);
    assert.ok(summary.metrics.contentEntries.publishedCount >= 1);
    assert.ok(Array.isArray(summary.recentEntries));
    assert.ok(summary.recentEntries.length >= 1);
    assert.equal(summary.recentEntries[0]?.schemaSlug, blueprintSlug);
  } finally {
    // Cleanup
    await ContentEntry.deleteMany({ projectId: project.id });
    await SchemaBlueprint.deleteMany({ projectId: project.id });
    await prisma.environment.deleteMany({ where: { projectId: project.id } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.workspace.delete({ where: { id: workspace.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});
