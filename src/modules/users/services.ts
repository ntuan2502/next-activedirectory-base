import { prisma } from "@/lib/db";
import { logAction } from "@/modules/audit-logs/services";
import { sseManager } from "@/lib/sse";
import { CreateUserInput, UpdateUserInput, GetUsersParams } from "./types";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { validatePassword } from "@/lib/password-validation";

export async function getUsersList(params: GetUsersParams) {
  const { page, limit, search, sortBy, sortOrder } = params;
  const offset = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {};

  if (search) {
    where.OR = [
      { username: { contains: search, mode: "insensitive" } },
      { displayName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
      {
        departments: {
          some: {
            OR: [
              { nameVi: { contains: search, mode: "insensitive" } },
              { nameEn: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
            ]
          }
        }
      },
      {
        companies: {
          some: {
            OR: [
              { nameVi: { contains: search, mode: "insensitive" } },
              { nameEn: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }

  const allowedSortFields = ["username", "displayName", "email", "title", "disabled"];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : "username";
  const sortDirection = sortOrder === "desc" ? "desc" : "asc";

  const orderBy: Prisma.UserOrderByWithRelationInput = { [sortField]: sortDirection };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy,
      skip: offset,
      take: limit,
      select: {
        id: true,
        dn: true,
        username: true,
        displayName: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        title: true,
        companies: {
          select: {
            id: true,
            code: true,
            nameVi: true,
            nameEn: true,
          }
        },
        departments: {
          select: {
            id: true,
            code: true,
            nameVi: true,
            nameEn: true,
          }
        },
        disabled: true,
        roles: {
          select: {
            id: true,
            name: true,
            isSystem: true,
          },
        },
      },
    }),
  ]);

  const formattedUsers = users.map((user) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { companies, departments, ...rest } = user;
    return {
      ...rest,
      company: user.companies.map((c) => c.code).join(", "),
      companyIds: user.companies.map((c) => c.id),
      department: user.departments.map((d) => d.nameVi || d.nameEn).join(", "),
      departmentIds: user.departments.map((d) => d.id),
    };
  });

  const totalPages = Math.ceil(total / limit);

  return {
    users: formattedUsers,
    pagination: {
      page,
      limit,
      totalCount: total,
      totalPages,
    },
  };
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      companies: {
        select: {
          id: true,
          code: true,
          nameVi: true,
          nameEn: true,
        }
      },
      departments: {
        select: {
          id: true,
          code: true,
          nameVi: true,
          nameEn: true,
        }
      },
      roles: {
        select: {
          id: true,
          name: true,
          isSystem: true,
        }
      }
    }
  });
}

export async function createUser(input: CreateUserInput) {
  const {
    username,
    displayName,
    firstName,
    lastName,
    email,
    phone,
    title,
    companyId,
    companyIds,
    departmentIds,
    password,
    roleIds,
  } = input;

  if (!username || !displayName || !email || !password) {
    throw new Error("MISSING_REQUIRED_FIELDS");
  }

  const lowercaseUsername = username.toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { username: lowercaseUsername },
  });

  if (existingUser) {
    throw new Error("USER_ALREADY_EXISTS");
  }

  const settings = await prisma.systemSetting.findFirst();
  if (settings) {
    const validationErrors = validatePassword(
      password,
      {
        passwordMinLength: settings.passwordMinLength,
        passwordPreventCommon: settings.passwordPreventCommon,
        passwordNoUserInfo: settings.passwordNoUserInfo,
        passwordRequireLetter: settings.passwordRequireLetter,
        passwordRequireNumber: settings.passwordRequireNumber,
        passwordRequireSymbol: settings.passwordRequireSymbol,
        passwordRequireMixedCase: settings.passwordRequireMixedCase,
      },
      {
        username: lowercaseUsername,
        email,
        firstName,
        lastName,
      }
    );

    if (validationErrors.length > 0) {
      throw new Error(`PASSWORD_VALIDATION_FAILED:${JSON.stringify(validationErrors)}`);
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const finalCompanyIds = companyIds && Array.isArray(companyIds)
    ? companyIds
    : (companyId ? [companyId] : []);

  const finalDepartmentIds = departmentIds && Array.isArray(departmentIds) ? departmentIds : [];

  const newUser = await prisma.user.create({
    data: {
      username: lowercaseUsername,
      displayName,
      firstName: firstName || "",
      lastName: lastName || "",
      email,
      phone: phone || "",
      title: title || "",
      companies: finalCompanyIds.length > 0 ? {
        connect: finalCompanyIds.map((id) => ({ id }))
      } : undefined,
      departments: finalDepartmentIds.length > 0 ? {
        connect: finalDepartmentIds.map((id) => ({ id }))
      } : undefined,
      passwordHash,
      dn: "", 
      disabled: false,
      roles: roleIds && Array.isArray(roleIds) ? {
        connect: roleIds.map((id: string) => ({ id })),
      } : undefined,
    },
    include: {
      companies: true,
      departments: true,
      roles: true,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _, ...userWithoutPassword } = newUser;
  const firstCompany = newUser.companies[0]?.code || "";
  const firstDept = newUser.departments.map(d => d.nameVi || d.nameEn).join(", ") || "";
  
  await logAction("user:create", lowercaseUsername, {
    status: "success",
    message: "auditLogsPage.messages.createUserSuccess",
    data: {
      before: null,
      after: {
        ...userWithoutPassword,
        company: firstCompany,
        department: firstDept,
      },
    },
  });

  return {
    ...userWithoutPassword,
    company: firstCompany,
    department: firstDept,
  };
}

export async function updateUser(id: string, input: UpdateUserInput & { roleIds?: string[], companyId?: string }) {
  const {
    displayName,
    firstName,
    lastName,
    email,
    phone,
    title,
    companyId,
    companyIds,
    departmentIds,
    disabled,
    roleIds,
  } = input;

  const existingUser = await prisma.user.findUnique({
    where: { id },
    include: {
      companies: true,
      departments: true,
      roles: true,
    },
  });

  if (!existingUser) {
    throw new Error("USER_NOT_FOUND");
  }

  const isLdapUser = existingUser.dn !== "";

  if (!isLdapUser && (!displayName || !email)) {
    throw new Error("MISSING_REQUIRED_FIELDS");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _, companies, departments, ...userBefore } = existingUser;

  let rolesUpdate = undefined;
  if (roleIds && Array.isArray(roleIds)) {
    rolesUpdate = {
      set: roleIds.map((rid: string) => ({ id: rid })),
    };
  }

  const updateData: Prisma.UserUpdateInput = {
    roles: rolesUpdate,
  };

  if (!isLdapUser) {
    updateData.displayName = displayName;
    updateData.firstName = firstName || "";
    updateData.lastName = lastName || "";
    updateData.email = email;
    updateData.phone = phone || "";
    updateData.title = title || "";
    updateData.disabled = disabled !== undefined ? !!disabled : existingUser.disabled;
  }

  if (companyIds !== undefined || companyId !== undefined) {
    const finalCompanyIds = companyIds && Array.isArray(companyIds)
      ? companyIds
      : (companyId ? [companyId] : []);

    updateData.companies = {
      set: finalCompanyIds.map((cid: string) => ({ id: cid }))
    };
  }

  if (departmentIds !== undefined) {
    const finalDepartmentIds = departmentIds && Array.isArray(departmentIds) ? departmentIds : [];

    updateData.departments = {
      set: finalDepartmentIds.map((did: string) => ({ id: did }))
    };
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: updateData,
    include: {
      companies: true,
      departments: true,
      roles: {
        select: {
          id: true,
          name: true,
          isSystem: true,
        },
      },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: __, companies: _c, departments: _d, ...userAfter } = updatedUser;

  await logAction("user:update", existingUser.username, {
    status: "success",
    message: "auditLogsPage.messages.updateUserSuccess",
    data: {
      before: {
        ...userBefore,
        company: existingUser.companies.map((c) => c.code).join(", ") || "None",
        department: existingUser.departments.map((d) => `${d.code} - ${d.nameVi}`).join(", ") || "None",
        roles: existingUser.roles.map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem })),
      },
      after: {
        ...userAfter,
        company: updatedUser.companies.map((c) => c.code).join(", ") || "None",
        department: updatedUser.departments.map((d) => `${d.code} - ${d.nameVi}`).join(", ") || "None",
        roles: updatedUser.roles.map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem })),
      },
    },
  });

  return {
    ...userAfter,
    companyIds: updatedUser.companies.map((c) => c.id),
    departmentIds: updatedUser.departments.map((d) => d.id),
    companyId: updatedUser.companies[0]?.id || "",
    department: updatedUser.departments[0]?.nameVi || updatedUser.departments[0]?.nameEn || "",
  };
}

export async function deleteUser(id: string) {
  const existingUser = await prisma.user.findUnique({
    where: { id },
    include: {
      companies: true,
      departments: true,
      roles: true,
    },
  });

  if (!existingUser) {
    throw new Error("USER_NOT_FOUND");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _, companies, departments, roles, ...userWithoutPassword } = existingUser;
  await logAction("user:delete", existingUser.username, {
    status: "success",
    message: "auditLogsPage.messages.deleteUserSuccess",
    data: {
      before: {
        ...userWithoutPassword,
        company: existingUser.companies.map((c) => c.code).join(", ") || "None",
        department: existingUser.departments.map((d) => `${d.code} - ${d.nameVi}`).join(", ") || "None",
        roles: existingUser.roles.map((r) => r.name).join(", ") || "None",
      },
      after: null,
    },
  });

  await prisma.user.delete({
    where: { id },
  });

  return true;
}

export async function resetUserPassword(id: string, passwordString: string) {
  const existingUser = await prisma.user.findUnique({
    where: { id },
  });

  if (!existingUser) {
    throw new Error("USER_NOT_FOUND");
  }

  if (existingUser.dn !== "") {
    throw new Error("CANNOT_RESET_PASSWORD_LDAP_USER");
  }

  const settings = await prisma.systemSetting.findFirst();
  if (settings) {
    const validationErrors = validatePassword(
      passwordString,
      {
        passwordMinLength: settings.passwordMinLength,
        passwordPreventCommon: settings.passwordPreventCommon,
        passwordNoUserInfo: settings.passwordNoUserInfo,
        passwordRequireLetter: settings.passwordRequireLetter,
        passwordRequireNumber: settings.passwordRequireNumber,
        passwordRequireSymbol: settings.passwordRequireSymbol,
        passwordRequireMixedCase: settings.passwordRequireMixedCase,
      },
      {
        username: existingUser.username,
        email: existingUser.email,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
      }
    );

    if (validationErrors.length > 0) {
      throw new Error(`PASSWORD_VALIDATION_FAILED:${JSON.stringify(validationErrors)}`);
    }
  }

  const passwordHash = await bcrypt.hash(passwordString, 12);

  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  });

  await logAction("user:change_password", existingUser.username, {
    status: "success",
    message: "auditLogsPage.details.passwordUpdatedSuccessfully",
    data: null,
  });

  return true;
}

export async function updateUserRoles(id: string, roleIds: string[]) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { roles: true }
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      roles: {
        set: roleIds.map((roleId: string) => ({ id: roleId })),
      },
    },
    include: {
      roles: {
        select: { id: true, name: true, isSystem: true }
      }
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _1, ...userWithoutPassword } = user;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _2, ...updatedUserWithoutPassword } = updatedUser;

  await logAction("user:update_roles", user.username, {
    status: "success",
    message: "auditLogsPage.messages.updateUserRolesSuccess",
    data: {
      before: userWithoutPassword,
      after: updatedUserWithoutPassword,
    },
  });

  sseManager.publish({
    userId: updatedUser.id,
    type: "PERMISSIONS_UPDATED",
  });

  return updatedUser;
}

export async function bulkUserActions(action: string, userIds: string[]) {
  if (userIds.length === 0) {
    throw new Error("NO_USERS_SELECTED");
  }

  const affectedUsers = await prisma.user.findMany({
    where: { id: { in: userIds } },
  });

  const usersBefore = affectedUsers.map((u) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...rest } = u;
    return rest;
  });

  if (action === "delete") {
    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
    await logAction("users:bulk_delete", null, {
      status: "success",
      message: "auditLogsPage.messages.bulkDeleteUsersSuccess",
      data: {
        before: usersBefore,
        after: null,
      },
    });
  } else if (action === "disable") {
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { disabled: true },
    });
    const usersAfter = usersBefore.map((u) => ({ ...u, disabled: true }));

    if (userIds.length === 1) {
      await logAction("user:lock", affectedUsers[0].username, {
        status: "success",
        message: "auditLogsPage.messages.lockUserSuccess",
        data: {
          before: usersBefore[0],
          after: usersAfter[0],
        },
      });
    } else {
      await logAction("users:bulk_lock", null, {
        status: "success",
        message: "auditLogsPage.messages.bulkLockUsersSuccess",
        data: {
          usernames: usersBefore.map((u) => u.username),
          details: usersBefore.map((u, i) => ({
            username: u.username,
            before: u,
            after: usersAfter[i],
          })),
          count: usersBefore.length,
        },
      });
    }
  } else if (action === "enable") {
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { disabled: false },
    });
    const usersAfter = usersBefore.map((u) => ({ ...u, disabled: false }));

    if (userIds.length === 1) {
      await logAction("user:unlock", affectedUsers[0].username, {
        status: "success",
        message: "auditLogsPage.messages.unlockUserSuccess",
        data: {
          before: usersBefore[0],
          after: usersAfter[0],
        },
      });
    } else {
      await logAction("users:bulk_unlock", null, {
        status: "success",
        message: "auditLogsPage.messages.bulkUnlockUsersSuccess",
        data: {
          usernames: usersBefore.map((u) => u.username),
          details: usersBefore.map((u, i) => ({
            username: u.username,
            before: u,
            after: usersAfter[i],
          })),
          count: usersBefore.length,
        },
      });
    }
  } else {
    throw new Error("INVALID_ACTION");
  }

  return true;
}
