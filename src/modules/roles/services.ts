import { prisma } from "@/lib/db";
import { logAction } from "@/modules/audit-logs/services";
import { sseManager } from "@/lib/sse";
import { CreateRoleInput, UpdateRoleInput } from "./types";
import { Prisma } from "@prisma/client";
import { BadRequestError, NotFoundError } from "@/lib/errors";

export async function getRolesList(params: {
  page: number;
  limit: number;
  search: string;
  type: string;
  sortBy: string;
  sortOrder: string;
}) {
  const { page, limit, search, type, sortBy, sortOrder } = params;
  const offset = (page - 1) * limit;

  const where: Prisma.RoleWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  if (type === "system") {
    where.isSystem = true;
  } else if (type === "custom") {
    where.isSystem = false;
  }

  const allowedSortFields = ["name", "description", "isSystem"];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : "name";
  const sortDirection = sortOrder === "desc" ? "desc" : "asc";

  let orderBy: Prisma.RoleOrderByWithRelationInput | Prisma.RoleOrderByWithRelationInput[] = {
    [sortField]: sortDirection,
  };

  if (sortBy === "usersCount") {
    orderBy = {
      users: {
        _count: sortDirection,
      },
    };
  }

  const [total, roles] = await Promise.all([
    prisma.role.count({ where }),
    prisma.role.findMany({
      where,
      orderBy,
      skip: offset,
      take: limit,
      include: {
        _count: {
          select: { users: true },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    roles,
    pagination: {
      page,
      limit,
      totalCount: total,
      totalPages,
    },
  };
}

export async function getRoleById(id: string) {
  return prisma.role.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true } },
    },
  });
}

export async function createRole(input: CreateRoleInput) {
  const { name, description, permissions } = input;

  if (!name) {
    throw new BadRequestError("rolesPage.roleNameRequired");
  }

  const existingRole = await prisma.role.findUnique({
    where: { name },
  });

  if (existingRole) {
    throw new BadRequestError("errors.roleNameExists");
  }

  const role = await prisma.role.create({
    data: {
      name,
      description,
      permissions: JSON.stringify(permissions || []),
    },
  });

  await logAction("role:create", role.name, {
    status: "success",
    message: "auditLogsPage.messages.createRoleSuccess",
    data: {
      before: null,
      after: {
        ...role,
        permissions: permissions || [],
      },
    },
  });

  return role;
}

export async function updateRole(id: string, input: UpdateRoleInput) {
  const { name, description, permissions } = input;

  const existingRole = await prisma.role.findUnique({
    where: { id },
  });

  if (!existingRole) {
    throw new NotFoundError("errors.roleNotFound");
  }

  if (existingRole.isSystem) {
    throw new BadRequestError("errors.systemRoleNotModified");
  }

  const updateData: Prisma.RoleUpdateInput = {
    name,
    description,
    permissions: JSON.stringify(permissions || []),
  };

  const role = await prisma.role.update({
    where: { id },
    data: updateData,
  });

  await logAction("role:update", role.name, {
    status: "success",
    message: "auditLogsPage.messages.updateRoleSuccess",
    data: {
      before: {
        ...existingRole,
        permissions: JSON.parse(existingRole.permissions || "[]"),
      },
      after: {
        ...role,
        permissions: JSON.parse(role.permissions || "[]"),
      },
    },
  });

  const roleWithUsers = await prisma.role.findUnique({
    where: { id },
    select: {
      users: {
        select: { id: true },
      },
    },
  });

  if (roleWithUsers?.users) {
    for (const u of roleWithUsers.users) {
      sseManager.publish({
        userId: u.id,
        type: "PERMISSIONS_UPDATED",
      });
    }
  }

  return role;
}

export async function deleteRole(id: string) {
  const existingRole = await prisma.role.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true } },
    },
  });

  if (!existingRole) {
    throw new NotFoundError("errors.roleNotFound");
  }

  if (existingRole.isSystem) {
    throw new BadRequestError("errors.systemRoleNotDeleted");
  }

  if (existingRole._count && existingRole._count.users > 0) {
    throw new BadRequestError("errors.cannotDeleteRoleHasUsers");
  }

  await logAction("role:delete", existingRole.name, {
    status: "success",
    message: "auditLogsPage.messages.deleteRoleSuccess",
    data: {
      before: {
        ...existingRole,
        permissions: JSON.parse(existingRole.permissions || "[]"),
      },
      after: null,
    },
  });

  await prisma.role.delete({
    where: { id },
  });

  return true;
}
