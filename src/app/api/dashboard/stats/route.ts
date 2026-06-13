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

    // 2. Department Breakdown (Top 5)
    const deptGroup = await prisma.user.groupBy({
      by: ["department"],
      _count: {
        id: true,
      },
      where: {
        department: { not: "" },
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
      take: 5,
    });

    const departmentStats = deptGroup.map((d) => ({
      name: d.department,
      count: d._count.id,
    }));

    // 3. Activity Timeline (Last 7 Days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setHours(0, 0, 0, 0);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // Include today

    const logs = await prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      select: {
        createdAt: true,
      },
    });

    // Initialize map of last 7 days
    const activityMap: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      activityMap[dateStr] = 0;
    }

    // Populate activity count
    logs.forEach((log) => {
      const dateStr = log.createdAt.toISOString().split("T")[0];
      if (dateStr in activityMap) {
        activityMap[dateStr]++;
      }
    });

    const activityStats = Object.keys(activityMap).sort().map((date) => {
      // Format to simple dd/MM
      const parts = date.split("-");
      const label = `${parts[2]}/${parts[1]}`;
      return {
        date,
        label,
        count: activityMap[date],
      };
    });

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
        activity: activityStats,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard statistics";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
