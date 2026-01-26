/**
 * Migrations index - register all migrations here
 */

import migrator from './migrator';
import { authSchemaMigration } from './001-auth-schema';

// Register all migrations
migrator.register(authSchemaMigration);

export default migrator;
