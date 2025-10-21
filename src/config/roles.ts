import { AccessControl } from 'accesscontrol';

export enum Roles {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
}

enum Resources {
  USER = 'user',
  ROLE = 'role',
  SUPPORT = 'support',
  TRANSACTION = 'transaction',
  COMPANY_PROFILE = 'company_profile',
}

export type PermissionAction = 'create' | 'read' | 'update' | 'delete';
export type PermissionScope = 'any' | 'own';

type Permissions = {
  [key in `${PermissionAction}:${PermissionScope}`]?: string[];
};

type RoleGrants = {
  [role in Roles]: {
    [resource in Resources]?: Permissions;
  };
};

const grantsObject: RoleGrants = {
  [Roles.SUPER_ADMIN]: {
    [Resources.USER]: {
      'create:any': ['*'],
      'read:any': ['*'],
      'read:own': ['*'],
      'update:any': ['*'],
      'update:own': ['*'],
      'delete:any': ['*'],
    },
    [Resources.ROLE]: {
      'create:any': ['*'],
      'read:any': ['*'],
      'update:any': ['*'],
      'delete:any': ['*'],
    },
    [Resources.SUPPORT]: {
      'read:any': ['*'],
      'update:any': ['*'],
      'delete:any': ['*'],
    },
    [Resources.TRANSACTION]: {
      'read:any': ['*'],
      'update:any': ['*'],
    },
    [Resources.COMPANY_PROFILE]: {
      'update:any': ['*'],
      'read:any': ['*'],
      'delete:any': ['*'],
    },
  },

  [Roles.ADMIN]: {
    [Resources.USER]: {
      'read:any': ['*'],
      'update:own': ['*'],
    },
    [Resources.TRANSACTION]: {
      'read:any': ['*'],
      'update:any': ['*'],
      'delete:any': ['*'],
    },
    [Resources.SUPPORT]: {
      'read:any': ['*'],
      'update:any': ['*'],
      'delete:any': ['*'],
    },
    [Resources.COMPANY_PROFILE]: {
      'update:any': ['*'],
      'read:any': ['*'],
      'delete:any': ['*'],
    },
  },
};

const ac = new AccessControl();
ac.setGrants(grantsObject);

const roles = ac;

export { roles, Resources };
