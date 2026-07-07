export interface CreateCompanyInput {
  code: string;
  nameVi?: string;
  nameEn?: string;
  taxAddress?: string;
  taxCode?: string;
}

export interface UpdateCompanyInput {
  code?: string;
  nameVi?: string;
  nameEn?: string;
  taxAddress?: string;
  taxCode?: string;
}
