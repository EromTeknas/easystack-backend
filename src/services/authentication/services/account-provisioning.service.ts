import logger from "../../../utils/logger";
import type { VerifiedProviderIdentity } from "../types/provider.types";
import { AccountProvisioningRepository } from "../repositories/account-provisioning.repository";
import { BillingService } from "../../billing.service";

export class AccountProvisioningService {
  constructor(private readonly repository: AccountProvisioningRepository) {}

  async activateExistingUser(userId: number, planKey: string) {
    const result = await this.repository.activateAndProvisionExistingUser(
      userId,
      planKey,
    );

    await this.invalidateBilling(result.workspaceId);
    return result;
  }

  async createExternalUser(input: {
    identity: VerifiedProviderIdentity;
    planKey: string;
  }) {
    const result = await this.repository.createExternalUserAndProvision(input);

    await this.invalidateBilling(result.workspaceId);
    return result;
  }

  private async invalidateBilling(workspaceId: number): Promise<void> {
    try {
      await BillingService.invalidate(workspaceId);
    } catch (error: any) {
      logger.error("Failed to invalidate billing cache after account provisioning", {
        workspaceId,
        error: error?.message,
      });
    }
  }
}
