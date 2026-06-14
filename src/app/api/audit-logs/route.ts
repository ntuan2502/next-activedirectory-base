import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { Prisma } from "@prisma/client";
import { DEFAULT_LIMIT } from "@/config/constants";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authResponse = await requirePermission(PERMISSIONS.AUDIT_LOGS_READ);
  if (authResponse) return authResponse;

  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || DEFAULT_LIMIT.toString())));
    const action = searchParams.get("action") || "";
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const offset = (page - 1) * limit;

    // Build filter conditions
    const where: Prisma.AuditLogWhereInput = {};

    if (action && action !== "all") {
      where.action = action;
    }

    if (search) {
      where.OR = [
        { username: { contains: search, mode: "insensitive" } },
        { target: { contains: search, mode: "insensitive" } },
        { details: { contains: search, mode: "insensitive" } },
        {
          user: {
            displayName: { contains: search, mode: "insensitive" },
          },
        },
      ];
    }

    // Determine sorting
    const allowedSortFields = ["createdAt", "username", "action", "target", "ipAddress"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortOrder === "asc" ? "asc" : "desc";

    const orderBy: Prisma.AuditLogOrderByWithRelationInput = {
      [sortField]: sortDirection,
    };

    // Execute parallel queries for count and data
    const [total, auditLogs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include: {
          user: {
            select: {
              displayName: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: auditLogs,
      pagination: {
        page,
        limit,
        totalCount: total,
        totalPages,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch audit logs.";
    console.error("Audit Logs API Error:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
