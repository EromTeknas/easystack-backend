// repositories/subscription.repository.ts

import { Prisma, SubscriptionStatus } from "@prisma/client";

import { BaseRepository } from "./base.repository";

export class SubscriptionRepository extends BaseRepository {
  async findByWorkspaceId(workspaceId: number) {
    return this.prisma.subscription.findUnique({
      where: { workspaceId },
      include: {
        planVersion: {
          include: {
            plan: true,
            trial: true,
            pricing: true,
            features: {
              include: {
                feature: true,
              },
            },
            quotas: {
              include: {
                quota: true,
              },
            },
          },
        },
      },
    });
  }

  async create(data: Prisma.SubscriptionCreateInput) {
    return this.prisma.subscription.create({
      data,
    });
  }

  async update(workspaceId: number, data: Prisma.SubscriptionUpdateInput) {
    return this.prisma.subscription.update({
      where: {
        workspaceId,
      },
      data,
    });
  }

  async delete(workspaceId: number) {
    return this.prisma.subscription.delete({
      where: {
        workspaceId,
      },
    });
  }

  async updateStatus(workspaceId: number, status: SubscriptionStatus) {
    return this.prisma.subscription.update({
      where: {
        workspaceId,
      },
      data: {
        status,
      },
    });
  }

  async upsert(
    workspaceId: number,
    create: Prisma.SubscriptionCreateInput,
    update: Prisma.SubscriptionUpdateInput,
  ) {
    return this.prisma.subscription.upsert({
      where: {
        workspaceId,
      },
      create,
      update,
    });
  }

  async exists(workspaceId: number) {
    return !!(await this.prisma.subscription.findUnique({
      where: { workspaceId },
      select: { id: true },
    }));
  }

  async findRaw(workspaceId: number) {
    return this.prisma.subscription.findUnique({
      where: { workspaceId },
    });
  }
}
