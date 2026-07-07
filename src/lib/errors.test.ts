import { describe, it, expect, vi } from "vitest";
import { NotFoundError, BadRequestError, PasswordValidationError, handleApiError } from "./errors";

describe("Errors module", () => {
  const t = vi.fn().mockImplementation((key, vars) => {
    if (vars) {
      return `translated:${key}:${JSON.stringify(vars)}`;
    }
    return `translated:${key}`;
  });

  describe("handleApiError", () => {
    it("should handle AppError subclass correctly", async () => {
      const error = new NotFoundError("errors.companyNotFound");
      const response = handleApiError(error, t, "errors.unknown");

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data).toEqual({ error: "translated:errors.companyNotFound" });
      expect(t).toHaveBeenCalledWith("errors.companyNotFound", undefined);
    });

    it("should handle BadRequestError with variables correctly", async () => {
      const error = new BadRequestError("errors.companyCodeExists", { code: "ACLT" });
      const response = handleApiError(error, t, "errors.unknown");

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({ error: 'translated:errors.companyCodeExists:{"code":"ACLT"}' });
    });

    it("should handle PasswordValidationError array correctly", async () => {
      const errors = [
        { key: "errors.passwordTooShort", variables: { minLength: 8 } },
        { key: "errors.passwordRequireNumber" },
      ];
      const error = new PasswordValidationError(errors);
      const response = handleApiError(error, t, "errors.unknown");

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('translated:errors.passwordTooShort:{"minLength":8}');
      expect(data.validationErrors).toEqual([
        { message: 'translated:errors.passwordTooShort:{"minLength":8}', key: "errors.passwordTooShort" },
        { message: "translated:errors.passwordRequireNumber", key: "errors.passwordRequireNumber" },
      ]);
    });

    it("should fall back to status 500 and default error message for generic errors", async () => {
      const error = new Error("Something broke inside the DB");
      const response = handleApiError(error, t, "errors.failedToUpdateUser");

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({ error: 'translated:errors.failedToUpdateUser:{"error":"Something broke inside the DB"}' });
    });
  });
});
