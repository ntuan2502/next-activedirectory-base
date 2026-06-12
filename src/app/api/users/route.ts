import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authResponse = await requirePermission(PERMISSIONS.USERS_READ);
  if (authResponse) return authResponse;

  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20", 10)));
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
        { company: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
      ];
    }

    // Determine sorting
    const allowedSortFields = ["username", "displayName", "email", "title", "department", "company", "disabled"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "username";
    const sortDirection = sortOrder === "desc" ? "desc" : "asc";

    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [sortField]: sortDirection,
    };

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
          company: true,
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

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        totalCount: total,
        totalPages,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch users.";
    console.error("Users API Error:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}

