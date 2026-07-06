import logger from "../../../logger.ts";
import { ResetService } from "../services/reset.service.ts";


async function run() {
  logger.info('Starting scheduled quota reset...');
  try {
    const results = await ResetService.resetDueUsage();
    logger.info('Reset completed successfully:', results);
  } catch (error) {
    logger.error('Reset failed:', error);
  } finally {
    process.exit(0); // Ensure the script exits when done
  }
}

run();
