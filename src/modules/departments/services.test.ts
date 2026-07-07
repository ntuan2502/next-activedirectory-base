import { describe, it, expect, vi } from "vitest";
import { prismaMock } from "../../../tests/helpers/prisma";
import { isDescendant, createDepartment, deleteDepartment, getDepartmentsList, updateDepartment } from "./services";
import { Department } from "@prisma/client";

vi.mock("@/modules/audit-logs/services", () => ({
  logAction: vi.fn().mockResolvedValue(undefined),
}));

describe("Departments Service", () => {
  describe("getDepartmentsList", () => {
    it("should fetch list of departments", async () => {
      const mockDepartments = [
        { id: "dept-1", code: "IT", nameVi: "CNTT", nameEn: "IT" }
      ];

      prismaMock.department.count.mockResolvedValue(1);
      prismaMock.department.findMany.mockResolvedValue(mockDepartments as unknown as Department[]);

      const result = await getDepartmentsList({
        page: 1,
        limit: 10,
        search: "IT",
        sortBy: "code",
        sortOrder: "asc",
        companyId: "comp-123",
      });

      expect(result.departments).toEqual(mockDepartments);
      expect(prismaMock.department.findMany).toHaveBeenCalled();
    });
  });

  describe("isDescendant", () => {
    it("should return true if childId equals parentId", async () => {
      const result = await isDescendant("dept-1", "dept-1");
      expect(result).toBe(true);
    });

    it("should return true if parentId is the direct parent of childId", async () => {
      prismaMock.department.findUnique.mockResolvedValue({
        id: "dept-2",
        parentId: "dept-1",
      } as unknown as Department);

      const result = await isDescendant("dept-2", "dept-1");
      expect(result).toBe(true);
    });

    it("should return true if parentId is an ancestor of childId (recursive)", async () => {
      prismaMock.department.findUnique
        .mockResolvedValueOnce({
          id: "dept-3",
          parentId: "dept-2",
        } as unknown as Department)
        .mockResolvedValueOnce({
          id: "dept-2",
          parentId: "dept-1",
        } as unknown as Department);

      const result = await isDescendant("dept-3", "dept-1");
      expect(result).toBe(true);
    });

    it("should return false if child has no parent", async () => {
      prismaMock.department.findUnique.mockResolvedValue({
        id: "dept-2",
        parentId: null,
      } as unknown as Department);

      const result = await isDescendant("dept-2", "dept-1");
      expect(result).toBe(false);
    });
  });

  describe("createDepartment", () => {
    it("should throw PARENT_DEPARTMENT_MUST_BELONG_TO_COMPANY if parent department company is different", async () => {
      prismaMock.department.findUnique.mockResolvedValue({
        id: "dept-parent",
        companyId: "comp-different",
      } as unknown as Department);

      await expect(
        createDepartment({
          code: "IT",
          nameVi: "CNTT",
          nameEn: "IT",
          companyId: "comp-current",
          parentId: "dept-parent",
        })
      ).rejects.toThrow("errors.parentDepartmentMustBelongToCompany");
    });

    it("should throw MANAGER_MUST_BELONG_TO_DEPARTMENT if manager is specified at creation", async () => {
      await expect(
        createDepartment({
          code: "IT",
          nameVi: "CNTT",
          nameEn: "IT",
          companyId: "comp-current",
          managerId: "user-123",
        })
      ).rejects.toThrow("errors.managerMustBelongToDepartment");
    });

    it("should throw DEPARTMENT_CODE_EXISTS if department code already exists", async () => {
      prismaMock.department.findFirst.mockResolvedValue({
        id: "dept-existing",
        code: "IT",
      } as unknown as Department);

      await expect(
        createDepartment({
          code: "IT",
          nameVi: "CNTT",
          nameEn: "IT",
          companyId: "comp-current",
        })
      ).rejects.toThrow("errors.departmentCodeExists");
    });
  });

  describe("updateDepartment", () => {
    it("should throw errors.departmentNotFound if department to update does not exist", async () => {
      prismaMock.department.findUnique.mockResolvedValue(null);

      await expect(
        updateDepartment("invalid-id", { code: "IT" })
      ).rejects.toThrow("errors.departmentNotFound");
    });

    it("should throw errors.invalidPayload if parent department is itself", async () => {
      prismaMock.department.findUnique.mockResolvedValue({
        id: "dept-123",
        code: "IT",
        companyId: "comp-123",
      } as unknown as Department);

      await expect(
        updateDepartment("dept-123", { parentId: "dept-123" })
      ).rejects.toThrow("errors.invalidPayload");
    });

    it("should throw errors.invalidPayload if updating parent creates a circular loop", async () => {
      prismaMock.department.findUnique
        .mockResolvedValueOnce({ id: "dept-1", code: "IT", parentId: null, companyId: "comp-123" } as unknown as Department)
        .mockResolvedValueOnce({ id: "dept-2", code: "HR", parentId: null, companyId: "comp-123" } as unknown as Department)
        .mockResolvedValueOnce({ id: "dept-2", parentId: "dept-1" } as unknown as Department);

      await expect(
        updateDepartment("dept-1", { parentId: "dept-2" })
      ).rejects.toThrow("errors.invalidPayload");
    });
  });

  describe("deleteDepartment", () => {
    it("should throw CANNOT_DELETE_DEPARTMENT_HAS_USERS if department has users", async () => {
      prismaMock.department.findUnique.mockResolvedValue({
        id: "dept-123",
        code: "IT",
        _count: { users: 2, subDepartments: 0 },
      } as unknown as Department);

      await expect(deleteDepartment("dept-123")).rejects.toThrow("errors.cannotDeleteDepartmentHasUsers");
    });

    it("should throw CANNOT_DELETE_DEPARTMENT_HAS_SUB_DEPARTMENTS if it has children", async () => {
      prismaMock.department.findUnique.mockResolvedValue({
        id: "dept-123",
        code: "IT",
        _count: { users: 0, subDepartments: 1 },
      } as unknown as Department);

      await expect(deleteDepartment("dept-123")).rejects.toThrow("errors.cannotDeleteDepartmentHasSubDepartments");
    });

    it("should delete department successfully when valid", async () => {
      prismaMock.department.findUnique.mockResolvedValue({
        id: "dept-123",
        code: "IT",
        companyObj: { code: "ACLT", nameVi: "Amata" },
        _count: { users: 0, subDepartments: 0 },
      } as unknown as Department);

      prismaMock.department.delete.mockResolvedValue({} as unknown as Department);

      const result = await deleteDepartment("dept-123");

      expect(result).toBe(true);
      expect(prismaMock.department.delete).toHaveBeenCalledWith({
        where: { id: "dept-123" },
      });
    });
  });
});
