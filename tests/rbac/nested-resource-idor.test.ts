import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, redisClient, connectMongo } from '../../src/db';
import mongoose from 'mongoose';
import { SchemaBlueprintService } from '../../src/services/schema-blueprint.service';
import { SchemaBlueprintRepository } from '../../src/repositories/schema-blueprint.repository';

before(async () => {
  await connectMongo();
});

after(async () => {
  await prisma.$disconnect();
  redisClient.quit();
  await mongoose.disconnect();
});

test('Nested Resource IDOR Protection (Schema Blueprints)', async (t) => {
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

  // Project A
  const projectA = await prisma.project.create({
    data: {
      name: 'Project A',
      slug: `proj-a-${Date.now()}`,
      workspaceId: workspace.id,
      createdById: user.id,
      resourceId: `proj_a_${Date.now()}`,
      environments: {
        create: {
          name: 'development',
          displayName: 'Development',
          isEditable: true,
          rank: 10,
        }
      }
    }
  });

  // Project B
  const projectB = await prisma.project.create({
    data: {
      name: 'Project B',
      slug: `proj-b-${Date.now()}`,
      workspaceId: workspace.id,
      createdById: user.id,
      resourceId: `proj_b_${Date.now()}`,
      environments: {
        create: {
          name: 'development',
          displayName: 'Development',
          isEditable: true,
          rank: 10,
        }
      }
    }
  });

  // Schema Blueprint in Project B
  const blueprintB = await SchemaBlueprintRepository.create({
    projectId: projectB.id,
    name: 'Blueprint B',
    slug: 'blueprint-b',
    type: 'collection',
    schemaDefinition: { version: 1, fields: [] },
    createdBy: user.id,
  });

  // Test 1: getSchemaById should fail when requesting Blueprint B under Project A
  await assert.rejects(
    SchemaBlueprintService.getSchemaById(projectA.id, String(blueprintB._id)),
    (err: any) => err.message.includes('not found'),
    'getSchemaById must enforce projectId matching'
  );

  // Clean up
  await SchemaBlueprintRepository.delete(String(blueprintB._id));
  await prisma.environment.deleteMany({ where: { projectId: { in: [projectA.id, projectB.id] } } });
  await prisma.project.delete({ where: { id: projectA.id } });
  await prisma.project.delete({ where: { id: projectB.id } });
  await prisma.workspace.delete({ where: { id: workspace.id } });
  await prisma.user.delete({ where: { id: user.id } });
});
