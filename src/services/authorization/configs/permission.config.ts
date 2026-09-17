export const PermissionConfig = {
  workspace: [
    "create",
    "read",
    "update",
    "delete",
    "invite",
    "manage_members",
    "transfer",
  ],

  project: [
    "create",
    "read",
    "update",
    "delete",
  ],

  project_member: [
    "read",
    "invite",
    "update",
    "remove",
  ],

  feed: [
    "read",
    "create",
    "update",
    "delete",
  ],

  localization: [
    "read",
    "create",
    "update",
    "release",
  ],

  environment: [
    "read",
    "update",
  ],

  deployment: [
    "read",
    "create",
  ],

  asset: [
    "create",
  ]
} as const;