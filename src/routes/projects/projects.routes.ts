import { Router } from 'express';
import {
  createProject,
  getProjectById,
  listProjectsByWorkspace,
  updateProject,
  patchProject,
  deleteProject
} from './projects.controller';
import {
  checkSubdomainAvailability
} from './projects.public.controller';
import { authenticate } from '../../services/authentication/middleware/express/authentication.middleware';

const router = Router();

// ============================================================================
// PUBLIC ROUTES (no authentication required)
// Must be defined BEFORE parameterized routes
// ============================================================================

/**
 * GET /api/projects/subdomain-available/:subdomain
 * Check if a subdomain is available (public, rate-limited)
 */
router.get('/subdomain-available/:subdomain', checkSubdomainAvailability);

// ============================================================================
// PROTECTED ROUTES (require authentication)
// ============================================================================

/**
 * POST /api/projects
 * Create a new project in a workspace
 * Required: workspaceId, name, subdomain
 * Body: { workspaceId: number, name: string, subdomain: string, description?: string }
 */
router.post('/', authenticate, createProject);

/**
 * GET /api/projects/workspaces/:workspaceId/projects
 * List all projects in a workspace
 * Uses authorization service to filter by OWNER/ADMIN/USER role
 */
router.get('/workspaces/:workspaceId', authenticate, listProjectsByWorkspace);

/**
 * GET /api/projects/:projectId
 * Get a single project with authorization check
 * Returns project details with permission resolution
 */
router.get('/:projectId', authenticate, getProjectById);

/**
 * PUT /api/projects/:projectId
 * Update a project (full replacement)
 * Required: name, subdomain
 * Optional: description
 */
router.put('/:projectId', authenticate, updateProject);

/**
 * PATCH /api/projects/:projectId
 * Partially update a project
 * Optional: name, subdomain, description (at least one required)
 */
router.patch('/:projectId', authenticate, patchProject);

/**
 * DELETE /api/projects/:projectId
 * Delete a project
 */
router.delete('/:projectId', authenticate, deleteProject);

export default router;
