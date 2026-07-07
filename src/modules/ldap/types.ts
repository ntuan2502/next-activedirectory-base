export interface LdapUserPreview {
  dn: string;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  title: string;
  department: string;
  company: string;
  employeeId: string;
  manager: string;
  phone: string;
  isSyncable?: boolean;
  isTest?: boolean;
}

export interface LdapCompanySyncDetail {
  code: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
}

export interface LdapDepartmentSyncDetail {
  code: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
}

export interface LdapSyncDetail {
  username: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
}
