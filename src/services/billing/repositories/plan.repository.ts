// repositories/plan.repository.ts

import { BaseRepository } from "./base.repository";

export class PlanRepository extends BaseRepository {

  async findByKey(key: string) {
    return this.prisma.plan.findUnique({
      where: { key },
    });
  }

  async findLatestVersion(planKey: string) {
    return this.prisma.planVersion.findFirst({
      where: {
        isLatest: true,
        plan: {
          key: planKey,
        },
      },
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
    });
  }

  async findVersion(planKey: string, version: number) {
    return this.prisma.planVersion.findFirst({
      where: {
        version,
        plan: {
          key: planKey,
        },
      },
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
    });
  }

  async listPublicPlans() {
    return this.prisma.plan.findMany({
      where: {
        isPublic: true,
        isActive: true,
      },
      orderBy: {
        displayOrder: "asc",
      },
    });
  }

  async listPlans() {
    return this.prisma.plan.findMany({
      orderBy: {
        displayOrder: "asc",
      },
    });
  }
}