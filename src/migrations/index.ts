/**
 * Migrations index - register all migrations here
 * Each migration is independent and handles a single table
 */

import migrator from './migrator';
import usersMigration from './001-create-users';
import refreshTokensMigration from './002-create-refresh-tokens';
// Deprecated tables (managed by Prisma going forward or removed): audit_logs, email_otps
// import auditLogsMigration from './003-create-audit-logs';
import workspacesMigration from './002-create-workspaces';
import workspaceMembersMigration from './003-create-workspace-members';
// import emailOtpsMigration from './004-create-email-otps';

// Register all migrations in order
// Each migration is independent and can be run/updated separately
migrator.register(usersMigration);
migrator.register(refreshTokensMigration);
migrator.register(workspacesMigration);
migrator.register(workspaceMembersMigration);
// Deprecated: audit_logs and email_otps tables are no longer used
// migrator.register(auditLogsMigration);


export default migrator;
