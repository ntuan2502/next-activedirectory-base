import { z } from "zod";

export const CreateRoleSchema = z.object({
  name: z.string().trim().min(2, "errors.roleNameTooShort"),
  description: z.string().trim().optional(),
  permissions: z.array(z.string()).optional(),
});

export const UpdateRoleSchema = CreateRoleSchema.partial();
