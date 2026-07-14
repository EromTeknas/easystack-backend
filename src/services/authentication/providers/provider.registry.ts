import type { AuthProvider } from "@prisma/client";

import { BadRequestError } from "../../../errors";
import type { AuthenticationProvider } from "../types/provider.types";

export class AuthenticationProviderRegistry {
  private readonly providers = new Map<AuthProvider, AuthenticationProvider>();

  constructor(providers: AuthenticationProvider[]) {
    for (const provider of providers) {
      this.providers.set(provider.provider, provider);
    }
  }

  get(provider: AuthProvider): AuthenticationProvider {
    const implementation = this.providers.get(provider);

    if (!implementation) {
      throw new BadRequestError(`Authentication provider '${provider}' is not enabled`);
    }

    return implementation;
  }
}
