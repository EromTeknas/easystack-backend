import test from "node:test";
import assert from "node:assert/strict";

import { BillingCycle, SubscriptionStatus } from "@prisma/client";

import { PlanValidator } from "../src/services/billing/validators/plan.validator.ts";
import { QuotaValidator } from "../src/services/billing/validators/quota.validator.ts";
import { SubscriptionValidator } from "../src/services/billing/validators/subscription.validator.ts";

const cache = {
  workspaceId: 1,
  version: 1,
  updatedAt: new Date().toISOString(),
  subscription: {
    status: SubscriptionStatus.ACTIVE,
    expiresAt: null,
    trialEndsAt: null,
    startsAt: new Date().toISOString(),
    cancelledAt: null,
    planKey: "pro",
    planDisplayName: "Pro",
    planVersionId: 1,
  },
  plan: {
    id: 1,
    key: "pro",
    displayName: "Pro",
    version: 1,
  },
  features: {
    "api.access": true,
    "ai.assistant": false,
  },
  quotas: {
    projects: 5,
    "api.requests.month": null,
  },
  usage: {
    projects: 2,
    "api.requests.month": 11,
  },
} as const;

test("PlanValidator accepts a valid plan definition", () => {
  assert.doesNotThrow(() => {
    PlanValidator.validateDefinition({
      key: "pro",
      version: 1,
      metadata: {
        displayName: "Pro",
        description: "Pro plan",
        isPublic: true,
        isEnterprise: false,
        isActive: true,
        displayOrder: 1,
      },
      trial: {
        enabled: true,
        durationDays: 14,
      },
      pricing: [
        {
          currency: "INR",
          billingCycle: BillingCycle.MONTHLY,
          amount: 499,
          isDefault: true,
        },
      ],
      features: {
        "api.access": true,
      },
      quotas: {
        projects: 5,
      },
    });
  });
});

test("PlanValidator rejects invalid trial duration", () => {
  assert.throws(
    () => {
      PlanValidator.validateDefinition({
        key: "pro",
        version: 1,
        metadata: {
          displayName: "Pro",
          description: "Pro plan",
          isPublic: true,
          isEnterprise: false,
          isActive: true,
          displayOrder: 1,
        },
        trial: {
          enabled: true,
          durationDays: -1,
        },
        pricing: [],
        features: {},
        quotas: {},
      });
    },
    { name: "InvalidPlanError" },
  );
});

test("QuotaValidator accepts unlimited quotas", () => {
  assert.doesNotThrow(() => {
    QuotaValidator.validateRequest(cache as never, [
      {
        key: "api.requests.month",
        amount: 100,
      },
    ]);
  });
});

test("QuotaValidator rejects missing quotas", () => {
  assert.throws(
    () => {
      QuotaValidator.validateRequest(cache as never, [
        {
          key: "unknown.quota",
          amount: 1,
        },
      ]);
    },
    { name: "QuotaNotFoundError" },
  );
});

test("QuotaValidator rejects quota overflow", () => {
  assert.throws(
    () => {
      QuotaValidator.validateRequest(cache as never, [
        {
          key: "projects",
          amount: 10,
        },
      ]);
    },
    { name: "QuotaExceededError" },
  );
});

test("SubscriptionValidator rejects paid trial access", () => {
  assert.throws(
    () => {
      SubscriptionValidator.validate(
        {
          ...cache,
          subscription: {
            ...cache.subscription,
            status: SubscriptionStatus.TRIAL,
          },
        } as never,
        { paidSubscription: true },
      );
    },
    { name: "TrialExpiredError" },
  );
});

test("SubscriptionValidator rejects missing subscription", () => {
  assert.throws(
    () => {
      SubscriptionValidator.validate(
        {
          ...cache,
          subscription: null,
        } as never,
        { subscription: true },
      );
    },
    { name: "SubscriptionRequiredError" },
  );
});
