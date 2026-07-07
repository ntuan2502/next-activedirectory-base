import { describe, it, expect, vi } from "vitest";
import { prismaMock } from "../../../tests/helpers/prisma";
import { createCompany, getCompanyById, deleteCompany, getCompaniesList, updateCompany } from "./services";
import { Company } from "@prisma/client";

vi.mock("@/modules/audit-logs/services", () => ({
  logAction: vi.fn().mockResolvedValue(undefined),
}));

describe("Companies Service", () => {
  describe("getCompaniesList", () => {
    it("should fetch list of companies with correct search criteria and sorting", async () => {
      const mockCompanies = [
        { id: "c1", code: "ACLT", nameVi: "Amata", nameEn: "Amata", taxCode: "123", taxAddress: "Address 1", createdAt: new Date() }
      ];

      prismaMock.company.count.mockResolvedValue(1);
      prismaMock.company.findMany.mockResolvedValue(mockCompanies as unknown as Company[]);

      const result = await getCompaniesList({
        page: 2,
        limit: 5,
        search: "Amata",
        sortBy: "nameVi",
        sortOrder: "desc",
      });

      expect(result.companies).toEqual(mockCompanies);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 5,
        totalCount: 1,
        totalPages: 1,
      });

      expect(prismaMock.company.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { code: { contains: "Amata", mode: "insensitive" } },
            { nameVi: { contains: "Amata", mode: "insensitive" } },
            { nameEn: { contains: "Amata", mode: "insensitive" } },
            { taxCode: { contains: "Amata", mode: "insensitive" } },
            { taxAddress: { contains: "Amata", mode: "insensitive" } },
          ],
        },
        orderBy: {
          nameVi: "desc",
        },
        skip: 5,
        take: 5,
        include: {
          _count: {
            select: { users: true, departments: true },
          },
        },
      });
    });
  });

  describe("createCompany", () => {
    it("should create a company with valid input", async () => {
      const mockInput = {
        code: "ACLT",
        nameVi: "AMATA LONG THANH VI",
        nameEn: "AMATA LONG THANH EN",
        taxAddress: "Long Thanh, Dong Nai",
        taxCode: "3603295006",
      };

      prismaMock.company.findUnique.mockResolvedValue(null);
      prismaMock.company.create.mockResolvedValue({
        id: "comp-123",
        code: "ACLT",
        nameVi: "AMATA LONG THANH VI",
        nameEn: "AMATA LONG THANH EN",
        taxAddress: "Long Thanh, Dong Nai",
        taxCode: "3603295006",
        createdAt: new Date(),
        updatedAt: new Date(),
        generalDirectorId: null,
      });

      const result = await createCompany(mockInput);

      expect(result.id).toBe("comp-123");
      expect(result.code).toBe("ACLT");
      expect(prismaMock.company.create).toHaveBeenCalled();
    });

    it("should throw COMPANY_CODE_EXISTS error if company code already exists", async () => {
      const mockInput = {
        code: "ACLT",
        nameVi: "AMATA LONG THANH VI",
        nameEn: "AMATA LONG THANH EN",
        taxAddress: "Long Thanh, Dong Nai",
        taxCode: "3603295006",
      };

      prismaMock.company.findUnique.mockResolvedValue({
        id: "comp-existing",
        code: "ACLT",
        nameVi: "Amata",
        nameEn: "Amata",
        taxAddress: "",
        taxCode: "",
        createdAt: new Date(),
        updatedAt: new Date(),
        generalDirectorId: null,
      });

      await expect(createCompany(mockInput)).rejects.toThrow("errors.companyCodeExists");
    });
  });

  describe("getCompanyById", () => {
    it("should return the company if found", async () => {
      const mockCompany = {
        id: "comp-123",
        code: "ACLT",
        nameVi: "Amata",
        nameEn: "Amata",
        taxAddress: "",
        taxCode: "",
        createdAt: new Date(),
        updatedAt: new Date(),
        generalDirectorId: null,
        _count: { users: 0 },
      };

      prismaMock.company.findUnique.mockResolvedValue(mockCompany);

      const result = await getCompanyById("comp-123");

      expect(result).toEqual(mockCompany);
      expect(prismaMock.company.findUnique).toHaveBeenCalledWith({
        where: { id: "comp-123" },
        include: { _count: { select: { users: true } } },
      });
    });
  });

  describe("updateCompany", () => {
    it("should update details successfully", async () => {
      const existing = {
        id: "comp-123",
        code: "ACLT",
        nameVi: "Amata Old",
        nameEn: "Amata Old",
        taxAddress: "",
        taxCode: "",
        createdAt: new Date(),
        updatedAt: new Date(),
        generalDirectorId: null,
      };

      prismaMock.company.findUnique.mockResolvedValue(existing);
      prismaMock.company.update.mockResolvedValue({
        ...existing,
        nameVi: "Amata New",
      });

      const result = await updateCompany("comp-123", { nameVi: "Amata New" });

      expect(result.nameVi).toBe("Amata New");
      expect(prismaMock.company.update).toHaveBeenCalled();
    });

    it("should throw error if company not found", async () => {
      prismaMock.company.findUnique.mockResolvedValue(null);

      await expect(updateCompany("invalid-id", { nameVi: "Amata" })).rejects.toThrow("errors.companyNotFound");
    });

    it("should throw error if code update is empty", async () => {
      prismaMock.company.findUnique.mockResolvedValue({ id: "comp-123", code: "ACLT" } as unknown as Company);

      await expect(updateCompany("comp-123", { code: "" })).rejects.toThrow("errors.companyCodeCannotBeEmpty");
    });

    it("should throw error if code duplicate exists", async () => {
      prismaMock.company.findUnique.mockResolvedValueOnce({ id: "comp-123", code: "ACLT" } as unknown as Company);
      prismaMock.company.findUnique.mockResolvedValueOnce({ id: "comp-456", code: "ACNEW" } as unknown as Company);

      await expect(updateCompany("comp-123", { code: "ACNEW" })).rejects.toThrow("errors.companyCodeExists");
    });
  });

  describe("deleteCompany", () => {
    it("should delete the company if it exists and has no users", async () => {
      prismaMock.company.findUnique.mockResolvedValue({
        id: "comp-123",
        code: "ACLT",
        nameVi: "Amata",
        nameEn: "Amata",
        taxAddress: "",
        taxCode: "",
        createdAt: new Date(),
        updatedAt: new Date(),
        generalDirectorId: null,
        _count: { users: 0 },
      } as unknown as Company);

      prismaMock.user.count.mockResolvedValue(0);
      prismaMock.company.delete.mockResolvedValue({} as unknown as Company);

      const result = await deleteCompany("comp-123");

      expect(result).toBe(true);
      expect(prismaMock.company.delete).toHaveBeenCalledWith({
        where: { id: "comp-123" },
      });
    });

    it("should throw COMPANY_NOT_FOUND if company does not exist", async () => {
      prismaMock.company.findUnique.mockResolvedValue(null);

      await expect(deleteCompany("comp-invalid")).rejects.toThrow("errors.companyNotFound");
    });

    it("should throw CANNOT_DELETE_COMPANY_HAS_USERS if company has users", async () => {
      prismaMock.company.findUnique.mockResolvedValue({
        id: "comp-123",
        code: "ACLT",
        nameVi: "Amata",
        nameEn: "Amata",
        taxAddress: "",
        taxCode: "",
        createdAt: new Date(),
        updatedAt: new Date(),
        generalDirectorId: null,
        _count: { users: 5 },
      } as unknown as Company);

      prismaMock.user.count.mockResolvedValue(5);

      await expect(deleteCompany("comp-123")).rejects.toThrow("errors.cannotDeleteCompanyHasUsers");
    });
  });
});
