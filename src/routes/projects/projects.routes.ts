import { Router } from 'express';
import {
  createProject,
  getProjectById,
  listProjectsByWorkspace,
  updateProject,
  patchProject,
  deleteProject,
  checkSubdomainAvailability,
  getProjectBySubdomain
} from './projects.controller';
import { authenticate } from '../../middlewares/authentication.middleware';

const router = Router();


// Protected routes (require authentication)
router.post('/', authenticate, createProject);
router.get('/workspaces/:workspaceId/projects', authenticate, listProjectsByWorkspace);
router.put('/:projectId', authenticate, updateProject);
router.patch('/:projectId', authenticate, patchProject);
router.delete('/:projectId', authenticate, deleteProject);
router.get('/:projectId', authenticate, getProjectById);
// Public routes (no authentication required - must come first before /:projectId)
router.get('/subdomain-available/:subdomain', checkSubdomainAvailability);
router.get('/by-subdomain/:subdomain', getProjectBySubdomain);

export default router;
