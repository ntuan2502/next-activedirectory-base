import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  // Require dashboard read permissions (can reuse users read permission or check if logged in)
  const authResponse = await requirePermission(PERMISSIONS.USERS_READ);
  if (authResponse) return authResponse;

  try {
    // 1. Sync Status Overview
    const totalUsers = await prisma.user.count();
    const activeSynced = await prisma.user.count({
      where: {
        dn: { not: "" },
        disabled: false,
      },
    });
    const disabledSynced = await prisma.user.count({
      where: {
        dn: { not: "" },
        disabled: true,
      },
    });
    const localUsers = await prisma.user.count({
      where: {
        dn: "",
      },
    });

    // 2. Department Breakdown
    const depts = await prisma.department.findMany({
      where: {
        users: {
          some: {}
        }
      },
      select: {
        nameVi: true,
        nameEn: true,
        _count: {
          select: {
            users: true
          }
        }
      },
      orderBy: {
        users: {
          _count: "desc"
        }
      }
    });

    const departmentStats = depts.map((d) => ({
      name: d.nameVi || d.nameEn || "Unknown",
      count: d._count.users,
    }));

    return NextResponse.json({
      success: true,
      data: {
        syncOverview: {
          total: totalUsers,
          active: activeSynced,
          disabled: disabledSynced,
          local: localUsers,
        },
        departments: departmentStats,
        activity: [],
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard statistics";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
