import { ResetService } from "../services/reset.service.ts";

export async function runQuotaResetJob() {
  return await ResetService.resetDueUsage();
}
