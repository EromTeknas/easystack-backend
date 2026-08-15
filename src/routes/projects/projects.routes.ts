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
  checkSubdomainAvailability,
  getProjectBySubdomain
} from './projects.public.controller';
import { authenticate } from '../../services/authentication/middleware/express/authentication.middleware';
import { authorize } from '../../services/authorization/middlewares/authorize.middleware';
import { PERMISSIONS } from '../../services/authorization/constants/permission.constants';
import { billingMiddleware } from '../../services/billing/middleware/express/billing.middleware';
import { Quotas } from '../../services/billing/config/quotas.config';
import { ProjectService } from '../../services/project.service';
import { BadRequestError } from '../../errors';

const router = Router();

const attachWorkspaceFromProject = async (req: any, _res: any, next: any) => {
  try {
    const projectId = Number(req.params.projectId);

    if (!Number.isInteger(projectId) || projectId <= 0) {
      throw new BadRequestError('projectId is required and must be a positive number');
    }

    const project = await ProjectService.getProjectById(projectId);
    req.workspace = {
      id: String(project.workspaceId),
      role: req.workspace?.role ?? 'WORKSPACE_MEMBER',
    };

    next();
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// PUBLIC ROUTES (no authentication required)
// Must be defined BEFORE parameterized routes
// ============================================================================

/**
 * GET /api/projects/subdomain-available/:subdomain
 * Check if a subdomain is available (public, rate-limited)
 */
router.get('/subdomain-available/:subdomain', checkSubdomainAvailability);

/**
 * GET /api/projects/subdomain/:subdomain
 * Get project details by subdomain (public)
 */
router.get('/subdomain/:subdomain', getProjectBySubdomain);

// ============================================================================
// PROTECTED ROUTES (require authentication)
// ============================================================================

/**
 * POST /api/projects
 * Create a new project in a workspace
 * Required: workspaceId, name, subdomain
 * Body: { workspaceId: number, name: string, subdomain: string, description?: string }
 */
router.post(
  '/',
  authenticate,
  authorize({
    scope: 'workspace',
    permission: PERMISSIONS.PROJECT.CREATE,
    scopeId: req => String(req.body?.workspaceId ?? ''),
  }),
  billingMiddleware(
    req => Number(req.body?.workspaceId),
    {
      subscription: true,
      quotas: [
        {
          key: Quotas.PROJECTS.key,
          amount: 1,
          consume: true,
        }
      ],
    }
  ),
  createProject
);

/**
 * GET /api/projects/workspaces/:workspaceId/projects
 * List all projects in a workspace
 * Uses authorization service to filter by OWNER/ADMIN/USER role
 */
router.get(
  '/workspaces/:workspaceId',
  authenticate,
  authorize({
    scope: 'workspace',
    permission: PERMISSIONS.PROJECT.READ,
    scopeId: req => req.params.workspaceId as string,
  }),
  listProjectsByWorkspace
);

/**
 * GET /api/projects/:projectId
 * Get a single project with authorization check
 * Returns project details with permission resolution
 */
router.get(
  '/:projectId',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.PROJECT.READ,
    scopeId: req => req.params.projectId as string,
  }),
  attachWorkspaceFromProject,
  getProjectById
);

/**
 * PUT /api/projects/:projectId
 * Update a project (full replacement)
 * Required: name, subdomain
 * Optional: description
 */
router.put(
  '/:projectId',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.PROJECT.UPDATE,
    scopeId: req => req.params.projectId as string,
  }),
  attachWorkspaceFromProject,
  billingMiddleware(
    req => Number(req.workspace?.id),
    {
      subscription: true,
      quotas: [
        {
          key: Quotas.API_REQUESTS.key,
          amount: 1,
          consume: true,
        },
      ],
    }
  ),
  updateProject
);

/**
 * PATCH /api/projects/:projectId
 * Partially update a project
 * Optional: name, subdomain, description (at least one required)
 */
router.patch(
  '/:projectId',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.PROJECT.UPDATE,
    scopeId: req => req.params.projectId as string,
  }),
  attachWorkspaceFromProject,
  billingMiddleware(
    req => Number(req.workspace?.id),
    {
      subscription: true,
      quotas: [
        {
          key: Quotas.API_REQUESTS.key,
          amount: 1,
          consume: true,
        },
      ],
    }
  ),
  patchProject
);

/**
 * DELETE /api/projects/:projectId
 * Delete a project
 */
router.delete(
  '/:projectId',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.PROJECT.UPDATE,
    scopeId: req => req.params.projectId as string,
  }),
  attachWorkspaceFromProject,
  billingMiddleware(
    req => Number(req.workspace?.id),
    {
      subscription: true,
      quotas: [
        {
          key: Quotas.API_REQUESTS.key,
          amount: 1,
          consume: true,
        },
      ],
    }
  ),
  deleteProject
);

export default router;
