import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { Prisma } from "@prisma/client";
import { DEFAULT_LIMIT } from "@/config/constants";
import { getServerTranslator } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authResponse = await requirePermission(PERMISSIONS.USERS_READ);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();
  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || DEFAULT_LIMIT.toString(), 10)));
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "username";
    const sortOrder = searchParams.get("sortOrder") || "asc";

    const offset = (page - 1) * limit;

    // Build filter conditions
    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: "insensitive" } },
        { displayName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { department: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        {
          companyObj: {
            OR: [
              { nameVi: { contains: search, mode: "insensitive" } },
              { nameEn: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    // Determine sorting
    const allowedSortFields = ["username", "displayName", "email", "title", "department", "disabled"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "username";
    const sortDirection = sortOrder === "desc" ? "desc" : "asc";

    const orderBy: Prisma.UserOrderByWithRelationInput = sortBy === "company"
      ? { companyObj: { code: sortDirection } }
      : { [sortField]: sortDirection };

    // Execute parallel queries for count and data
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        select: {
          id: true,
          username: true,
          displayName: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          title: true,
          department: true,
          companyId: true,
          companyObj: {
            select: {
              id: true,
              code: true,
              nameVi: true,
              nameEn: true,
              taxAddress: true,
              taxCode: true,
            },
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
      return {
        ...user,
        company: user.companyObj?.code || "",
      };
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: formattedUsers,
      pagination: {
        page,
        limit,
        totalCount: total,
        totalPages,
      },
    });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToFetchUsers", { error: rawMessage });
    console.error(error);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}

