import { z } from "zod";

export const CreateUserSchema = z.object({
  username: z.string().trim().min(3, "errors.usernameTooShort").regex(/^[a-zA-Z0-9._-]+$/, "errors.usernameInvalid"),
  displayName: z.string().trim().min(2, "errors.displayNameTooShort"),
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  email: z.string().trim().email("errors.invalidEmailFormat"),
  phone: z.string().trim().optional(),
  title: z.string().trim().optional(),
  companyId: z.string().uuid("errors.invalidCompanyId").optional().nullable(),
  companyIds: z.array(z.string().uuid("errors.invalidCompanyId")).optional(),
  departmentIds: z.array(z.string().uuid("errors.invalidDepartmentId")).optional(),
  roleIds: z.array(z.string().uuid("errors.invalidRoleId")).optional(),
  password: z.string().min(1, "errors.passwordRequired"),
});

export const UpdateUserSchema = CreateUserSchema.partial().omit({ password: true, username: true });
export const ResetPasswordSchema = z.object({
  password: z.string().min(1, "errors.passwordRequired"),
});
export const BulkUserActionsSchema = z.object({
  action: z.enum(["delete", "enable", "disable"]),
  userIds: z.array(z.string().uuid("errors.invalidUserId")),
});
