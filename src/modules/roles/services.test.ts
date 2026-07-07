import { describe, it, expect, vi } from "vitest";
import { prismaMock } from "../../../tests/helpers/prisma";
import { createRole, getRolesList, getRoleById, updateRole, deleteRole } from "./services";
import { Role } from "@prisma/client";

vi.mock("@/modules/audit-logs/services", () => ({
  logAction: vi.fn().mockResolvedValue(undefined),
}));

describe("Roles Service", () => {
  describe("getRolesList", () => {
    it("should return paginated and filtered roles list", async () => {
      const mockRoles = [
        { id: "role-1", name: "Admin", description: "Admin description", isSystem: true },
        { id: "role-2", name: "User", description: "User description", isSystem: false },
      ];

      prismaMock.role.count.mockResolvedValue(2);
      prismaMock.role.findMany.mockResolvedValue(mockRoles as unknown as Role[]);

      const result = await getRolesList({
        page: 1,
        limit: 10,
        search: "Admin",
        type: "all",
        sortBy: "name",
        sortOrder: "asc",
      });

      expect(result.roles).toHaveLength(2);
      expect(result.pagination.totalCount).toBe(2);
      expect(prismaMock.role.findMany).toHaveBeenCalled();
    });
  });

  describe("getRoleById", () => {
    it("should return role if found", async () => {
      const mockRole = {
        id: "role-123",
        name: "Admin",
        description: "Admin",
        isSystem: true,
        _count: { users: 2 },
      };

      prismaMock.role.findUnique.mockResolvedValue(mockRole as unknown as Role);

      const result = await getRoleById("role-123");

      expect(result).toEqual(mockRole);
    });
  });

  describe("createRole", () => {
    it("should create new role with valid input", async () => {
      prismaMock.role.findUnique.mockResolvedValue(null);
      prismaMock.role.create.mockResolvedValue({
        id: "role-123",
        name: "Viewer",
        description: "Viewer desc",
        permissions: "[]",
        isSystem: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await createRole({
        name: "Viewer",
        description: "Viewer desc",
        permissions: [],
      });

      expect(result.name).toBe("Viewer");
      expect(prismaMock.role.create).toHaveBeenCalled();
    });

    it("should throw error if role name exists", async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: "role-existing",
        name: "Viewer",
      } as unknown as Role);

      await expect(
        createRole({
          name: "Viewer",
        })
      ).rejects.toThrow("errors.roleNameExists");
    });
  });

  describe("updateRole", () => {
    it("should throw systemRoleNotModified for system roles", async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: "role-system",
        name: "Admin",
        isSystem: true,
      } as unknown as Role);

      await expect(
        updateRole("role-system", {
          name: "Admin Edited",
        })
      ).rejects.toThrow("errors.systemRoleNotModified");
    });
  });

  describe("deleteRole", () => {
    it("should throw systemRoleNotDeleted for system roles", async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: "role-system",
        name: "Admin",
        isSystem: true,
      } as unknown as Role);

      await expect(deleteRole("role-system")).rejects.toThrow("errors.systemRoleNotDeleted");
    });

    it("should throw cannotDeleteRoleHasUsers if role has connected users", async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: "role-123",
        name: "Viewer",
        isSystem: false,
        _count: { users: 3 },
      } as unknown as Role);

      await expect(deleteRole("role-123")).rejects.toThrow("errors.cannotDeleteRoleHasUsers");
    });
  });
});
