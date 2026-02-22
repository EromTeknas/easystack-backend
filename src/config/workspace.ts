/**
 * Workspace Configuration
 * Centralized workspace settings and defaults
 */

export const workspace = {
  // Default workspace settings
  defaults: {
    name: 'My Workspace',
    description: 'Your default workspace'
  },
  
  // Workspace role types
  roles: {
    OWNER: 'OWNER',
    ADMIN: 'ADMIN',
    DEVELOPER: 'DEVELOPER',
    PUBLISHER: 'PUBLISHER'
  },
  
  // Workspace status
  status: {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    ARCHIVED: 'ARCHIVED'
  }
};

export default workspace;
