import { asyncHandler } from "../../utils/asyncHandler";
import { hashPassword } from "../../utils/password";
import { generateOtpCode, hashOtp } from "../../utils/otp";
import {
  isValidEmail,
  isValidPassword,
  isValidName,
} from "../../utils/validation";
import {
  BadRequestError,
  ConflictError,
  InternalServerError,
} from "../../errors";
import { AUTH_ERROR_CODES } from "../../constants/errorCodes";
import { prisma } from "../../db";
import logger from "../../utils/logger";
import { SubscriptionStatus, UserStatus } from "@prisma/client";
import { ok } from '../../utils/response';
import { enqueueSendOtpEmailJob } from "../../queues/email-otp.queue";
import { createEmailVerificationToken } from "../../services/email-verification-redis.service";
import { UsageService } from "../../services/billing/services/usage.service.ts";
import { BillingService } from "../../services/billing.service";

/**
 * Register a new user account (transactional)
 * POST /auth/register
 *
 * Flow:
 * 1. Validate input
 * 2. Create or update unverified user + assign plan (ATOMIC)
 * 3. Generate and send OTP (outside transaction to avoid delays)
 * 4. Return user info (no tokens until verified)
 */
export const registerController = asyncHandler(async (req, res) => {
  logger.info("POST /api/auth/register start");
  const { email, password, confirmPassword, firstName, lastName, planKey } =
    req.body;

  // Validate input
  if (!email || !password || !confirmPassword || !firstName || !lastName) {
    throw new BadRequestError(
      "Email, password, confirm password, first name, and last name are required",
    );
  }

  if (!isValidEmail(email)) {
    throw new BadRequestError("Invalid email format", { field: "email" });
  }

  if (!isValidPassword(password)) {
    throw new BadRequestError("Password does not meet requirements", {
      field: "password",
      requirements: [
        "At least 12 characters",
        "At least one uppercase letter",
        "At least one lowercase letter",
        "At least one number",
        "At least one special character",
      ],
    });
  }

  if (password !== confirmPassword) {
    throw new BadRequestError("Password and confirm password do not match", {
      field: "confirmPassword",
    });
  }

  if (!isValidName(firstName) || !isValidName(lastName)) {
    throw new BadRequestError(
      "Names must be valid and not exceed 100 characters",
    );
  }

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      emailVerified: true,
      status: true,
    },
  });

  if (existingUser && existingUser.emailVerified) {
    // Already verified: block registration
    throw new ConflictError(
      "Email already registered. Please log in.",
      AUTH_ERROR_CODES.EMAIL_ALREADY_VERIFIED,
      {
        field: "email",
      },
    );
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Transactional: Create/update user + assign plan
  const result = await prisma.$transaction(async (tx) => {
    let userId: number;

    if (!existingUser) {
      const created = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          emailVerified: false,
          status: UserStatus.PENDING_VERIFICATION,
        },
      });

      userId = created.id;

      logger.info("New user created in transaction", { userId });
    } else {
      const updated = await tx.user.update({
        where: { id: existingUser.id },
        data: {
          passwordHash,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          status: UserStatus.PENDING_VERIFICATION,
        },
      });

      userId = updated.id;

      logger.info("Existing user updated in transaction", { userId });
    }

    const selectedPlanKey = planKey ?? "free";

    const plan = await tx.plan.findUnique({
      where: {
        key: selectedPlanKey.toLowerCase(),
      },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          include: { trial: true }
        },
      },
    });

    if (!plan) {
      throw new BadRequestError("Invalid plan selected");
    }

    const latestVersion = plan.versions[0];

    if (!latestVersion) {
      throw new InternalServerError(
        `No active version found for plan '${plan.key}'`,
      );
    }

    // Calculate Dynamic Status
    let status = SubscriptionStatus.ACTIVE as SubscriptionStatus;
    let trialEndsAt: Date | null = null;

    if (plan.key !== "free" && latestVersion.trial?.enabled) {
      status = SubscriptionStatus.TRIAL as SubscriptionStatus;
      trialEndsAt = new Date(Date.now() + latestVersion.trial.durationDays * 24 * 60 * 60 * 1000);
    }

    const subscription = await tx.subscription.upsert({
      where: { userId },
      update: {
        planVersionId: latestVersion.id,
        status, 
        startsAt: new Date(),
        trialEndsAt, 
        expiresAt: null,
      },
      create: {
        userId,
        planVersionId: latestVersion.id,
        status,
        startsAt: new Date(),
        trialEndsAt,
        expiresAt: null,
      },
    });

    await tx.subscriptionHistory.create({
      data: {
        subscriptionId: subscription.id,
        planVersionId: latestVersion.id,
        status,
        startsAt: new Date(),
        reason: "REGISTER",
      },
    });

    logger.info("Plan assigned in transaction", {
      userId,
      plan: plan.key,
      version: latestVersion.version,
    });

    // Step 3: Generate OTP and send email (outside transaction)
    const otpCode = generateOtpCode();
    const otpCodeHash = await hashOtp(otpCode);

    const verificationToken = await createEmailVerificationToken(
      userId.toString(),
      email.toLowerCase(),
      otpCodeHash,
      "EMAIL_VERIFICATION",
    );

    await enqueueSendOtpEmailJob({
      email: email.toLowerCase(),
      firstName,
      otpCode,
    });

    return {
      userId,
      planVersionId: latestVersion.id,
      email: email.toLowerCase(),
      verificationToken,
    };
  });

  await BillingService.invalidate(result.userId);
  await UsageService.initialize(result.userId, result.planVersionId);

  return ok(res, {
    email: result.email,
    verificationToken: result.verificationToken,
  });
});
