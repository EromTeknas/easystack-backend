import { BadRequestError } from "../../../errors";
import {
  isValidEmail,
  isValidName,
  isValidPassword,
} from "../../../utils/validation";
import { authenticationConfig } from "../config/authentication.config";
import type {
  LoginPasswordInput,
  RegisterPasswordInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from "../types/authentication.types";

export class AuthenticationValidationService {
  validateRegistration(input: RegisterPasswordInput) {
    const email = this.normalizeEmail(input.email);
    const firstName = input.firstName?.trim();
    const lastName = input.lastName?.trim();

    if (!input.password || !input.confirmPassword || !firstName || !lastName) {
      throw new BadRequestError(
        "Email, password, confirm password, first name, and last name are required",
      );
    }

    if (!isValidPassword(input.password)) {
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

    if (input.password !== input.confirmPassword) {
      throw new BadRequestError("Password and confirm password do not match", {
        field: "confirmPassword",
      });
    }

    if (!isValidName(firstName) || !isValidName(lastName)) {
      throw new BadRequestError(
        "Names must be valid and not exceed 100 characters",
      );
    }

    const planKey = (input.planKey ?? "free").toLowerCase();

    if (!authenticationConfig.publicSignupPlanKeys.has(planKey)) {
      throw new BadRequestError("Selected signup plan is not available");
    }

    return {
      email,
      password: input.password,
      firstName,
      lastName,
      planKey,
    };
  }

  validatePasswordLogin(input: LoginPasswordInput) {
    const email = this.normalizeEmail(input.email);

    if (!input.password) {
      throw new BadRequestError("Email and password are required");
    }

    return { email, password: input.password };
  }

  validateEmailVerification(input: VerifyEmailInput): VerifyEmailInput {
    if (!input.verificationToken || typeof input.verificationToken !== "string") {
      throw new BadRequestError("verificationToken is required");
    }

    if (!input.otpCode || typeof input.otpCode !== "string") {
      throw new BadRequestError("otpCode is required");
    }

    return input;
  }

  validatePasswordReset(input: ResetPasswordInput): ResetPasswordInput {
    if (!input.token || !input.password || !input.confirmPassword) {
      throw new BadRequestError(
        "token, password, and confirmPassword are required",
      );
    }

    if (!isValidPassword(input.password)) {
      throw new BadRequestError("Password does not meet requirements", {
        field: "password",
      });
    }

    if (input.password !== input.confirmPassword) {
      throw new BadRequestError("Password and confirm password do not match", {
        field: "confirmPassword",
      });
    }

    return input;
  }

  normalizeEmail(email: string | undefined): string {
    if (!email || !isValidEmail(email)) {
      throw new BadRequestError("Invalid email format", { field: "email" });
    }

    return email.trim().toLowerCase();
  }
}
