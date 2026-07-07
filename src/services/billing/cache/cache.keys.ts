export const BILLING_CACHE_KEYS = {
  WORKSPACE: (workspaceId: number) => `billing:v1:workspace:${workspaceId}`,
  WORKSPACE_USAGE: (workspaceId: number) => `billing:v1:workspace:${workspaceId}:usage`,
  WORKSPACE_FEATURES: (workspaceId: number) => `billing:v1:workspace:${workspaceId}:features`,
  WORKSPACE_QUOTAS: (workspaceId: number) => `billing:v1:workspace:${workspaceId}:quotas`,
  WORKSPACE_SUBSCRIPTION: (workspaceId: number) => `billing:v1:workspace:${workspaceId}:subscription`,
  WORKSPACE_PLAN: (workspaceId: number) => `billing:v1:workspace:${workspaceId}:plan`,
};
