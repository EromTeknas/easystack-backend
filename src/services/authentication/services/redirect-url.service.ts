import { BadRequestError } from "../../../errors";

const DEFAULT_REDIRECT_URL = "/dashboard";

export class RedirectUrlService {
  private readonly allowedOrigins: Set<string>;

  constructor(allowedOrigins: string[] = []) {
    this.allowedOrigins = new Set(
      allowedOrigins
        .map((origin) => origin.trim())
        .filter(Boolean)
        .map((origin) => this.normalizeOrigin(origin)),
    );
  }

  resolve(input: unknown): string {
    if (input === undefined || input === null || input === "") {
      return DEFAULT_REDIRECT_URL;
    }

    if (typeof input !== "string") {
      throw new BadRequestError("redirectUrl must be a string", {
        field: "redirectUrl",
      });
    }

    const redirectUrl = input.trim();

    if (!redirectUrl) {
      return DEFAULT_REDIRECT_URL;
    }

    if (redirectUrl.startsWith("//")) {
      throw new BadRequestError("Invalid redirectUrl", {
        field: "redirectUrl",
      });
    }

    if (redirectUrl.startsWith("/")) {
      return redirectUrl;
    }

    let parsed: URL;

    try {
      parsed = new URL(redirectUrl);
    } catch {
      throw new BadRequestError("redirectUrl must be an app-relative path", {
        field: "redirectUrl",
      });
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new BadRequestError("Invalid redirectUrl protocol", {
        field: "redirectUrl",
      });
    }

    if (!this.allowedOrigins.has(parsed.origin)) {
      throw new BadRequestError("redirectUrl origin is not allowed", {
        field: "redirectUrl",
        origin: parsed.origin,
      });
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }

  private normalizeOrigin(value: string): string {
    try {
      return new URL(value).origin;
    } catch {
      return value.replace(/\/+$/, "");
    }
  }
}

const configuredOrigins = [
  process.env.CORS_ORIGIN,
  process.env.FRONTEND_URL,
  process.env.APP_FRONTEND_URL,
].flatMap((value) => (value ? value.split(",") : []));

export const redirectUrlService = new RedirectUrlService(configuredOrigins);
