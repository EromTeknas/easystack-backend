export const Plans = [
  {
    key: "free",
    displayName: "Free",
    description: "Perfect for individuals getting started.",
    version: 1,
    config: {
      limits: {
        workspaces: 1,
        projects: 3,
        environments: 3,
        members: 1,
        apiRequestsPerMinute: 60,
        storageMb: 500,
        aiTokensMonthly: 100_000,
      },

      features: {
        customDomain: false,
        teamCollaboration: false,
        auditLogs: false,
      },

      pricing: {
        monthly: 0,
        yearly: 0,
        currency: "USD",
      },
    },
  },

  {
    key: "pro",
    displayName: "Pro",
    description: "For freelancers and professionals.",
    version: 1,
    config: {
      limits: {
        workspaces: 5,
        projects: 20,
        environments: 10,
        members: 3,
        apiRequestsPerMinute: 300,
        storageMb: 5_000,
        aiTokensMonthly: 1_000_000,
      },

      features: {
        customDomain: true,
        teamCollaboration: false,
        auditLogs: false,
      },

      pricing: {
        monthly: 29,
        yearly: 290,
        currency: "USD",
      },
    },
  },

  {
    key: "team",
    displayName: "Team",
    description: "Small teams and agencies.",
    version: 1,
    config: {
      limits: {
        workspaces: 25,
        projects: 100,
        environments: 20,
        members: 10,
        apiRequestsPerMinute: 1000,
        storageMb: 20_000,
        aiTokensMonthly: 5_000_000,
      },

      features: {
        customDomain: true,
        teamCollaboration: true,
        auditLogs: true,
      },

      pricing: {
        monthly: 99,
        yearly: 990,
        currency: "USD",
      },
    },
  },

  {
    key: "enterprise",
    displayName: "Enterprise",
    description: "Unlimited usage with enterprise support.",
    version: 1,
    config: {
      limits: {
        workspaces: null,
        projects: null,
        environments: null,
        members: null,
        apiRequestsPerMinute: null,
        storageMb: null,
        aiTokensMonthly: null,
      },

      features: {
        customDomain: true,
        teamCollaboration: true,
        auditLogs: true,
      },

      pricing: {
        monthly: 499,
        yearly: 4990,
        currency: "USD",
      },
    },
  },
] as const;