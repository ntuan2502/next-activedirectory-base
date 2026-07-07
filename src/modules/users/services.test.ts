import { describe, it, expect, vi } from "vitest";
import { prismaMock } from "../../../tests/helpers/prisma";
import { createUser, getUsersList, updateUser, resetUserPassword, bulkUserActions } from "./services";
import bcrypt from "bcryptjs";
import { User, SystemSetting } from "@prisma/client";

vi.mock("@/modules/audit-logs/services", () => ({
  logAction: vi.fn().mockResolvedValue(undefined),
}));

describe("Users Service", () => {
  describe("getUsersList", () => {
    it("should return users list with matching criteria", async () => {
      const mockUsers = [
        {
          id: "u1",
          username: "johndoe",
          displayName: "John",
          email: "john@example.com",
          companies: [],
          departments: [],
          roles: [],
        }
      ];

      prismaMock.user.count.mockResolvedValue(1);
      prismaMock.user.findMany.mockResolvedValue(mockUsers as unknown as User[]);

      const result = await getUsersList({
        page: 1,
        limit: 10,
        search: "John",
        sortBy: "username",
        sortOrder: "asc",
      });

      expect(result.users).toHaveLength(1);
      expect(prismaMock.user.findMany).toHaveBeenCalled();
    });
  });

  describe("createUser", () => {
    it("should throw MISSING_REQUIRED_FIELDS if required fields are missing", async () => {
      await expect(
        createUser({
          username: "",
          displayName: "John Doe",
          email: "john@example.com",
          password: "password",
        })
      ).rejects.toThrow("errors.missingRequiredFields");
    });

    it("should throw USER_ALREADY_EXISTS if user already exists", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "user-1",
        username: "johndoe",
      } as unknown as User);

      await expect(
        createUser({
          username: "johndoe",
          displayName: "John Doe",
          email: "john@example.com",
          password: "password",
        })
      ).rejects.toThrow("errors.userAlreadyExists");
    });

    it("should validate password and throw PasswordValidationError if it is too short", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.systemSetting.findFirst.mockResolvedValue({
        passwordMinLength: 8,
      } as unknown as SystemSetting);

      await expect(
        createUser({
          username: "johndoe",
          displayName: "John Doe",
          email: "john@example.com",
          password: "short",
        })
      ).rejects.toThrow("errors.passwordValidationFailed");
    });

    it("should hash password and create user when input is valid", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      prismaMock.systemSetting.findFirst.mockResolvedValue(null);

      const mockCreatedUser = {
        id: "new-user-id",
        username: "johndoe",
        displayName: "John Doe",
        firstName: "",
        lastName: "",
        email: "john@example.com",
        phone: "",
        title: "",
        passwordHash: "hashed-pw",
        disabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        companies: [],
        departments: [],
        roles: [],
      };

      prismaMock.user.create.mockResolvedValue(mockCreatedUser as unknown as User);
      prismaMock.user.findUnique.mockResolvedValueOnce({
        ...mockCreatedUser,
        companies: [],
        departments: [],
        roles: [],
      } as unknown as User);

      const spyHash = vi.spyOn(bcrypt, "hash").mockImplementation(async () => "hashed-pw");

      const result = await createUser({
        username: "johndoe",
        displayName: "John Doe",
        email: "john@example.com",
        password: "password123",
      });

      expect(result.id).toBe("new-user-id");
      expect(result.username).toBe("johndoe");
      expect(spyHash).toHaveBeenCalledWith("password123", 12);
      expect(prismaMock.user.create).toHaveBeenCalled();

      spyHash.mockRestore();
    });
  });

  describe("updateUser", () => {
    it("should throw error if user to update does not exist", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        updateUser("invalid-id", { displayName: "New Name" })
      ).rejects.toThrow("errors.userNotFound");
    });

    it("should throw MISSING_REQUIRED_FIELDS for local user if name is empty", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "user-123",
        dn: "",
      } as unknown as User);

      await expect(
        updateUser("user-123", { displayName: "", email: "test@example.com" })
      ).rejects.toThrow("errors.missingRequiredFields");
    });
  });

  describe("resetUserPassword", () => {
    it("should throw error if resetting password of AD/LDAP user", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "user-123",
        username: "aduser",
        dn: "CN=aduser,OU=Users,DC=example,DC=com",
      } as unknown as User);

      await expect(
        resetUserPassword("user-123", "newpassword123")
      ).rejects.toThrow("errors.cannotResetPasswordLdapUser");
    });
  });

  describe("bulkUserActions", () => {
    it("should throw error if no user is selected", async () => {
      await expect(
        bulkUserActions("delete", [])
      ).rejects.toThrow("errors.noUsersSelected");
    });

    it("should perform bulk actions successfully", async () => {
      prismaMock.user.findMany.mockResolvedValue([
        { id: "u1", username: "user1" },
        { id: "u2", username: "user2" },
      ] as unknown as User[]);

      prismaMock.user.deleteMany.mockResolvedValue({ count: 2 });

      const result = await bulkUserActions("delete", ["u1", "u2"]);
      expect(result).toBe(true);
      expect(prismaMock.user.deleteMany).toHaveBeenCalled();
    });
  });
});
