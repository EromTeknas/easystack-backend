import {
  Prisma,
  PrismaClient,
} from "@prisma/client";

import { PlanRepository } from "../repositories/plan.repository";

export class PlanService {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
    private readonly plans = new PlanRepository(prisma),
  ) {}

  getPublicPlans() {
    return this.plans.listPublicPlans();
  }

  getAllPlans() {
    return this.plans.listPlans();
  }

  getLatest(planKey: string) {
    return this.plans.findLatestVersion(planKey);
  }

  getVersion(
    planKey: string,
    version: number,
  ) {
    return this.plans.findVersion(
      planKey,
      version,
    );
  }

  async validatePlan(planKey: string) {
    const plan = await this.getLatest(planKey);

    if (!plan) {
      throw new Error(`Plan '${planKey}' not found.`);
    }

    return plan;
  }
}