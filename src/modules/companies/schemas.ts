import { z } from "zod";

export const CreateCompanySchema = z.object({
  code: z.string().trim().min(2, "errors.companyCodeTooShort").max(10, "errors.companyCodeTooLong"),
  nameVi: z.string().trim().min(2, "errors.companyNameViTooShort"),
  nameEn: z.string().trim().optional(),
  taxAddress: z.string().trim().optional(),
  taxCode: z.string().trim().optional(),
});

export const UpdateCompanySchema = CreateCompanySchema.partial();
