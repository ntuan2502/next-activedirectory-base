export interface GetUsersParams {
  page: number;
  limit: number;
  search: string;
  sortBy: string;
  sortOrder: string;
}

export interface CreateUserInput {
  username: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  title?: string;
  companyId?: string;
  companyIds?: string[];
  departmentIds?: string[];
  password?: string;
  roleIds?: string[];
}

export interface UpdateUserInput {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  title?: string;
  companyIds?: string[];
  departmentIds?: string[];
  disabled?: boolean;
}
