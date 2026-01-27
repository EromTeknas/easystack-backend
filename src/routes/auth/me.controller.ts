/**
 * Get Me Controller
 * GET /auth/me
 * 
 * Returns current authenticated user with all their workspaces
 */

import { asyncHandler } from '../../utils/asyncHandler';
import { UnauthorizedError, InternalServerError } from '../../errors';
import { db } from '../../db';
import logger from '../../utils/logger';
import { getUserWorkspaces } from '../../services/workspace.service';

/**
 * Get current authenticated user with workspaces
 * GET /auth/me
 */
export const getMeController = asyncHandler(async (req: any, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedError('Not authenticated');
    }

    // Get user details
    const [[user]] = (await db.query(
      'SELECT id, email, first_name, last_name, email_verified, status, created_at FROM users WHERE id = ?',
      [userId]
    )) as any[];

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Get user's workspaces
    const workspaces = await getUserWorkspaces(userId);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id.toString(),
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          emailVerified: user.email_verified,
          status: user.status,
          createdAt: user.created_at
        },
        workspaces: workspaces.map((w: any) => ({
          id: w.id,
          name: w.name,
          logoUrl: w.logo_url,
          role: w.role,
          createdAt: w.created_at
        }))
      }
    });
  } catch (error: any) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }

    logger.error('Failed to get user profile', {
      userId: req.user?.id,
      error: error.message
    });

    throw new InternalServerError('Failed to retrieve user profile');
  }
});
