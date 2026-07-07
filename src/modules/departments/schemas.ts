import { z } from "zod";

export const CreateDepartmentSchema = z.object({
  code: z.string().trim().min(2, "errors.departmentCodeTooShort"),
  nameVi: z.string().trim().min(2, "errors.departmentNameViTooShort"),
  nameEn: z.string().trim().optional(),
  companyId: z.string().uuid("errors.invalidCompanyId").nullable().optional(),
  parentId: z.string().uuid("errors.invalidParentDepartmentId").nullable().optional(),
  managerId: z.string().uuid("errors.invalidManagerId").nullable().optional(),
  subDepartmentIds: z.array(z.string().uuid("errors.invalidSubDepartmentId")).optional(),
  userIds: z.array(z.string().uuid("errors.invalidUserId")).optional(),
});

export const UpdateDepartmentSchema = CreateDepartmentSchema.partial();
