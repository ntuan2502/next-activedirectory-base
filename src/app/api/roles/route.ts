import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/audit";
import { Prisma } from "@prisma/client";
import { DEFAULT_LIMIT } from "@/config/constants";
import { getServerTranslator } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authResponse = await requirePermission(PERMISSIONS.ROLES_READ);
  if (authResponse) return authResponse;

  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || DEFAULT_LIMIT.toString(), 10)));
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "all";
    const sortBy = searchParams.get("sortBy") || "name";
    const sortOrder = searchParams.get("sortOrder") || "asc";

    const offset = (page - 1) * limit;

    // Build filter conditions
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

    // Determine sorting
    const allowedSortFields = ["name", "description", "isSystem"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "name";
    const sortDirection = sortOrder === "desc" ? "desc" : "asc";

    let orderBy: Prisma.RoleOrderByWithRelationInput | Prisma.RoleOrderByWithRelationInput[] = {
      [sortField]: sortDirection,
    };

    // Special case for sorting by users count
    if (sortBy === "usersCount") {
      orderBy = {
        users: {
          _count: sortDirection,
        },
      };
    }

    // Execute parallel queries for count and data
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

    return NextResponse.json({
      success: true,
      data: roles,
      pagination: {
        page,
        limit,
        totalCount: total,
        totalPages,
      },
    });
  } catch (error: unknown) {
    const { t } = await getServerTranslator();
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToFetchRoles", { error: rawMessage });
    console.error(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResponse = await requirePermission(PERMISSIONS.ROLES_CREATE);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const body = await request.json();
    const { name, description, permissions } = body;

    if (!name) {
      return NextResponse.json({ error: t("rolesPage.roleNameRequired") }, { status: 400 });
    }

    const existingRole = await prisma.role.findUnique({
      where: { name },
    });

    if (existingRole) {
      return NextResponse.json({ error: t("errors.roleNameExists") }, { status: 400 });
    }

    const role = await prisma.role.create({
      data: {
        name,
        description,
        permissions: JSON.stringify(permissions || []),
      },
    });

    await logAction("role:create", role.name, {
      before: null,
      after: {
        ...role,
        permissions: permissions || [],
      },
    });

    return NextResponse.json({ success: true, data: role });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToCreateRole", { error: rawMessage });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
