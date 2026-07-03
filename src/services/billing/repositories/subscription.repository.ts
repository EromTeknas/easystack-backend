// repositories/subscription.repository.ts

import { Prisma, SubscriptionStatus } from "@prisma/client";

import { BaseRepository } from "./base.repository";

export class SubscriptionRepository extends BaseRepository {
  async findByUserId(userId: number) {
    return this.prisma.subscription.findUnique({
      where: { userId },
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

  async update(userId: number, data: Prisma.SubscriptionUpdateInput) {
    return this.prisma.subscription.update({
      where: {
        userId,
      },
      data,
    });
  }

  async delete(userId: number) {
    return this.prisma.subscription.delete({
      where: {
        userId,
      },
    });
  }

  async updateStatus(userId: number, status: SubscriptionStatus) {
    return this.prisma.subscription.update({
      where: {
        userId,
      },
      data: {
        status,
      },
    });
  }

  async upsert(
    userId: number,
    create: Prisma.SubscriptionCreateInput,
    update: Prisma.SubscriptionUpdateInput,
  ) {
    return this.prisma.subscription.upsert({
      where: {
        userId,
      },
      create,
      update,
    });
  }

  async exists(userId: number) {
    return !!(await this.prisma.subscription.findUnique({
      where: { userId },
      select: { id: true },
    }));
  }

  async findRaw(userId: number) {
    return this.prisma.subscription.findUnique({
      where: { userId },
    });
  }
}
