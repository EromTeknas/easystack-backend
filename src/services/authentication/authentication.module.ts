import { prisma } from "../../db";
import { BullMqAuthenticationNotifier } from "./adapters/bullmq-authentication.notifier";
import { EmailVerificationCache } from "./cache/email-verification.cache";
import { PasswordResetCache } from "./cache/password-reset.cache";
import { GoogleAuthenticationProvider } from "./providers/google-auth.provider";
import { AuthenticationProviderRegistry } from "./providers/provider.registry";
import { AccountProvisioningRepository } from "./repositories/account-provisioning.repository";
import { AuthenticationRepository } from "./repositories/authentication.repository";
import { SessionRepository } from "./repositories/session.repository";
import { AccountProvisioningService } from "./services/account-provisioning.service";
import { AuthenticationValidationService } from "./services/authentication-validation.service";
import { EmailVerificationService } from "./services/email-verification.service";
import { PasswordResetService } from "./services/password-reset.service";
import { SessionService } from "./services/session.service";
import { TokenService } from "./services/token.service";
import { AuthenticationService } from "./authentication.service";

const notifier = new BullMqAuthenticationNotifier();
const authenticationRepository = new AuthenticationRepository(prisma);
const sessionRepository = new SessionRepository(prisma);
const provisioningRepository = new AccountProvisioningRepository(prisma);

const provisioningService = new AccountProvisioningService(
  provisioningRepository,
);

const emailVerificationService = new EmailVerificationService(
  new EmailVerificationCache(),
  authenticationRepository,
  provisioningService,
  notifier,
);

const passwordResetService = new PasswordResetService(
  new PasswordResetCache(),
  authenticationRepository,
  notifier,
);

const sessionService = new SessionService(
  sessionRepository,
  new TokenService(),
);

const providerRegistry = new AuthenticationProviderRegistry([
  new GoogleAuthenticationProvider(),
]);

export const authenticationService = new AuthenticationService(
  authenticationRepository,
  providerRegistry,
  provisioningService,
  emailVerificationService,
  passwordResetService,
  sessionService,
  new AuthenticationValidationService(),
  notifier,
);
