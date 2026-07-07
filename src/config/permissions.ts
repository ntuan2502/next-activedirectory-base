export const PERMISSIONS = {
  // Users Group
  USERS_READ: "users:read",
  USERS_CREATE: "users:create",
  USERS_UPDATE: "users:update",
  USERS_DELETE: "users:delete",

  // Companies Group
  COMPANIES_READ: "companies:read",
  COMPANIES_CREATE: "companies:create",
  COMPANIES_UPDATE: "companies:update",
  COMPANIES_DELETE: "companies:delete",

  // Roles Group
  ROLES_READ: "roles:read",
  ROLES_CREATE: "roles:create",
  ROLES_UPDATE: "roles:update",
  ROLES_DELETE: "roles:delete",

  // Departments Group
  DEPARTMENTS_READ: "departments:read",
  DEPARTMENTS_CREATE: "departments:create",
  DEPARTMENTS_UPDATE: "departments:update",
  DEPARTMENTS_DELETE: "departments:delete",

  // LDAP Group
  LDAP_TEST: "ldap:test",
  LDAP_SYNC: "ldap:sync",

  // System Audits
  AUDIT_LOGS_READ: "audit_logs:read",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export interface PermissionItem {
  id: Permission;
  name: string;
  description: string;
  group: string;
}

export const AVAILABLE_PERMISSIONS: PermissionItem[] = [
  // Users Management
  { id: PERMISSIONS.USERS_READ, name: "View Users", description: "Can view the list of users and active directory status.", group: "Users Management" },
  { id: PERMISSIONS.USERS_CREATE, name: "Create Users", description: "Can create new local users.", group: "Users Management" },
  { id: PERMISSIONS.USERS_UPDATE, name: "Update Users", description: "Can update user roles and toggle status (enable/disable).", group: "Users Management" },
  { id: PERMISSIONS.USERS_DELETE, name: "Delete Users", description: "Can delete users from the system.", group: "Users Management" },

  // Companies Management
  { id: PERMISSIONS.COMPANIES_READ, name: "View Companies", description: "Can view the list of companies.", group: "Companies Management" },
  { id: PERMISSIONS.COMPANIES_CREATE, name: "Create Companies", description: "Can create new companies.", group: "Companies Management" },
  { id: PERMISSIONS.COMPANIES_UPDATE, name: "Update Companies", description: "Can modify details of existing companies.", group: "Companies Management" },
  { id: PERMISSIONS.COMPANIES_DELETE, name: "Delete Companies", description: "Can delete companies (only if they have no users).", group: "Companies Management" },

  // Roles Management
  { id: PERMISSIONS.ROLES_READ, name: "View Roles", description: "Can view the list of roles and their configured permissions.", group: "Roles Management" },
  { id: PERMISSIONS.ROLES_CREATE, name: "Create Roles", description: "Can create new custom access control roles.", group: "Roles Management" },
  { id: PERMISSIONS.ROLES_UPDATE, name: "Update Roles", description: "Can modify permissions and descriptions of custom roles.", group: "Roles Management" },
  { id: PERMISSIONS.ROLES_DELETE, name: "Delete Roles", description: "Can delete custom access control roles.", group: "Roles Management" },

  // Departments Management
  { id: PERMISSIONS.DEPARTMENTS_READ, name: "View Departments", description: "Can view the list of departments.", group: "Departments Management" },
  { id: PERMISSIONS.DEPARTMENTS_CREATE, name: "Create Departments", description: "Can create new departments.", group: "Departments Management" },
  { id: PERMISSIONS.DEPARTMENTS_UPDATE, name: "Update Departments", description: "Can modify details of existing departments.", group: "Departments Management" },
  { id: PERMISSIONS.DEPARTMENTS_DELETE, name: "Delete Departments", description: "Can delete departments (only if they have no users).", group: "Departments Management" },

  // LDAP Integration
  { id: PERMISSIONS.LDAP_TEST, name: "Test LDAP Connection", description: "Can perform LDAP connection health checks and test credentials.", group: "LDAP Integration" },
  { id: PERMISSIONS.LDAP_SYNC, name: "Sync LDAP Data", description: "Can trigger directory synchronization and import users.", group: "LDAP Integration" },

  // System Audits
  { id: PERMISSIONS.AUDIT_LOGS_READ, name: "View Audit Logs", description: "Can view and search the system activity logs.", group: "System Audits" },
];
