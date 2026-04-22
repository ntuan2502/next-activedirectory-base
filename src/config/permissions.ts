export const PERMISSIONS = {
  USERS_READ: "users:read",
  USERS_WRITE: "users:write",
  ROLES_MANAGE: "roles:manage",
  LDAP_SYNC: "ldap:sync",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export const AVAILABLE_PERMISSIONS = [
  { id: PERMISSIONS.USERS_READ, name: "View Users", description: "Can view the list of users." },
  { id: PERMISSIONS.USERS_WRITE, name: "Manage Users", description: "Can edit, delete, or bulk action users." },
  { id: PERMISSIONS.ROLES_MANAGE, name: "Manage Roles", description: "Can create, edit, and delete roles." },
  { id: PERMISSIONS.LDAP_SYNC, name: "Sync LDAP", description: "Can fetch and sync users from LDAP." },
];
