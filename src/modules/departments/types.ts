export interface CreateDepartmentInput {
  code: string;
  nameVi: string;
  nameEn?: string;
  companyId?: string | null;
  parentId?: string | null;
  managerId?: string | null;
  subDepartmentIds?: string[];
  userIds?: string[];
}

export interface UpdateDepartmentInput {
  code?: string;
  nameVi?: string;
  nameEn?: string;
  companyId?: string | null;
  parentId?: string | null;
  managerId?: string | null;
  subDepartmentIds?: string[];
  userIds?: string[];
}

export interface FormattedDepartmentLog {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string;
  company: string;
  parentDepartment: string;
  manager: string;
  subDepartments: string;
  users: string;
}

export interface DepartmentWithRelations {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string;
  companyObj?: { code: string; nameVi: string } | null;
  parentObj?: { code: string; nameVi: string } | null;
  managerObj?: { displayName: string | null; username: string } | null;
  subDepartments?: { code: string; nameVi: string }[] | null;
  users?: { id: string; username: string; displayName: string }[] | null;
}
