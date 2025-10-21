import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { Permission } from 'accesscontrol';

import { PermissionAction, PermissionScope, Resources, Roles, roles } from '../config/roles';
import AppError from '../utils/AppError';

interface IDecodedToken {
  id: string;
  role: string;
}

export interface UserRequest extends Request {
  user?: IDecodedToken;
}

/**
 * Middleware to enforce role-based access using AccessControl.
 *
 * @param action - The permission action: 'create', 'read', 'update', or 'delete'.
 * @param scope - The permission scope: 'any' or 'own'.
 * @param resource - The resource to protect (e.g., Resources.USER_INFO).
 *
 * Usage:
 * index.get('/user/:id', authenticateJWT, grantAccess('read', 'own', Resources.USER_INFO), getUserInfo);
 *
 * This middleware checks that the user's role has permission for the given action and scope on the resource.
 *
 * Throws a 403 AppError if permission is not granted.
 */
function grantAccess(action: PermissionAction, scope: PermissionScope, resource: Resources) {
  return async (req: UserRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.role) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'Model not authenticated or role not found');
      }
      // For example: 'create' and 'any' => 'createAny'; 'read' and 'own' => 'readOwn'
      const methodName = `${action}${scope === 'any' ? 'Any' : 'Own'}` as keyof ReturnType<typeof roles.can>;
      const permission: Permission = roles.can(req.user.role)[methodName](resource) as Permission;

      if (!permission.granted) {
        throw new AppError(httpStatus.FORBIDDEN, "You don't have permission to perform this action");
      }

      next();
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
      } else {
        next(new AppError(httpStatus.FORBIDDEN, 'An unknown error occurred'));
      }
    }
  };
}

/**
 * Middleware to authorize a user based on their role and resource ownership.
 *
 * @param {PermissionAction} action - The specific action to check permissions for (e.g., 'read', 'update').
 * @param {Resources} resource - The type of resource the permission applies to (e.g., 'user', 'course').
 *
 * Logic:
 * - Ensures the user is authenticated.
 * - Checks if the current user owns the resource (by comparing user ID to the resource ID in the route parameter).
 * - Grants full access to SUPER_ADMIN users for any resource.
 * - Grants limited access to ADMIN users only for their own resource.
 * - Denies access to other users or unauthorized actions.
 *
 * @returns {Function} Express middleware function that either grants access, or responds with an appropriate error.
 */

function authorizeRoleAndOwnership(action: PermissionAction, resource: Resources) {
  return (req: UserRequest, res: Response, next: NextFunction) => {
    const currentUser = req.user;
    const resourceId = req.params.id; //The resource you want to update is yours e.d, update profile

    if (!currentUser) {
      return next(new AppError(httpStatus.UNAUTHORIZED, 'Model not authenticated'));
    }

    if (currentUser.role === Roles.SUPER_ADMIN) {
      return grantAccess(action, 'any', resource)(req, res, next);
    }

    const isOwnResource = currentUser.id === resourceId;
    if (currentUser.role === Roles.ADMIN && isOwnResource) {
      return grantAccess(action, 'own', resource)(req, res, next);
    }

    return next(new AppError(httpStatus.FORBIDDEN, "You don't have permission to perform this action"));
  };
}

export { grantAccess, authorizeRoleAndOwnership };
