import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma, redisClient } from '../../src/db';
import mongoose from 'mongoose';
import { createUploadIntent } from '../../src/routes/storage/storage.controller';
import { APP_ROLES } from '../../src/services/authorization/constants/role.constants';
import { AppError } from '../../src/errors';

import { storageService } from '../../src/services/storage/storage.instance';

after(async () => {
  await prisma.$disconnect();
  redisClient.quit();
  await mongoose.disconnect();
});

// Mock the actual S3 operation so it doesn't hang the test
const originalCreateUploadIntent = storageService.createUploadIntent;
storageService.createUploadIntent = async () => ({ uploadId: 'mock-123', upload: {} as any });

test('Storage / Asset Authorization', async (t) => {
  const user = await prisma.user.create({
    data: {
      email: `storage-user-${Date.now()}@example.com`,
      firstName: 'Storage',
      lastName: 'User',
      resourceId: `usr_storage_${Date.now()}`
    }
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: `Workspace Storage`,
      slug: `ws-storage-${Date.now()}`,
      createdById: user.id,
      resourceId: `ws_storage_${Date.now()}`
    }
  });

  const workspaceAdminRole = await prisma.role.findFirst({ where: { key: APP_ROLES.WORKSPACE.WORKSPACE_ADMIN } });
  const workspaceGuestRole = await prisma.role.findFirst({ where: { key: APP_ROLES.WORKSPACE.WORKSPACE_GUEST } });

  // Make user an ADMIN in Workspace
  const adminMember = await prisma.workspaceMember.create({
    data: {
      userId: user.id,
      workspaceId: workspace.id,
      roleId: workspaceAdminRole!.id,
    }
  });

  // Test 1: Admin can upload workspace logo
  let req: any = {
    user: { id: user.id },
    body: {
      preset: 'workspace-logo',
      targetNodes: [{ collection: 'workspaces', id: workspace.id }],
      file: {
        originalName: 'logo.png',
        mimeType: 'image/png',
        sizeBytes: 1024,
      }
    }
  };

  const { AuthorizationService } = require('../../src/services/authorization/services/authorization.service');

  await new Promise<void>((resolve, reject) => {
    const mockRes = {
      status: (code: number) => mockRes,
      setHeader: () => mockRes,
      json: (data: any) => {
        resolve(); // Route handler succeeded
        return data;
      }
    } as any;

    createUploadIntent(req, mockRes, (err: any) => {
      if (err) reject(err);
      else resolve(); // In case next() is called
    });
  });

  // Demote to GUEST
  await prisma.workspaceMember.update({
    where: { id: adminMember.id },
    data: { roleId: workspaceGuestRole!.id }
  });

  // Let's clear redis cache for user
  const keys = await redisClient.keys(`auth:*`);
  if (keys.length > 0) {
      await redisClient.del(keys);
  }

  // Test 2: Guest cannot upload workspace logo
  await assert.rejects(
    async () => {
      await new Promise<void>((resolve, reject) => {
        const mockRes = {
          status: (code: number) => mockRes,
          setHeader: () => mockRes,
          json: (data: any) => {
            resolve();
            return data;
          }
        } as any;
        createUploadIntent(req, mockRes, (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
    (err: any) => err instanceof AppError && err.statusCode === 403,
    'Workspace Guest should NOT be able to upload workspace logo (requires WORKSPACE.UPDATE)'
  );

  // Clean up
  await prisma.workspaceMember.delete({ where: { id: adminMember.id } });
  await prisma.workspace.delete({ where: { id: workspace.id } });
  await prisma.user.delete({ where: { id: user.id } });
});
