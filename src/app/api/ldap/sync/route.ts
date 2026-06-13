import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/audit";
import { fetchLdapUsers, syncLdapUsers, logLdapSyncResult } from "@/lib/sync-core";

export const dynamic = "force-dynamic";

// GET: Return a preview of LDAP users
export async function GET() {
  const authResponse = await requirePermission(PERMISSIONS.LDAP_SYNC);
  if (authResponse) return authResponse;

  try {
    const ldapUsers = await fetchLdapUsers();

    await logAction("ldap:fetch_data", "success", { count: ldapUsers.length });

    return NextResponse.json({
      success: true,
      data: ldapUsers,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch preview data from LDAP";
    console.error("LDAP Preview Error:", error);

    await logAction("ldap:fetch_data", "failed", { error: message });

    return NextResponse.json(
      { error: message },
      { status: 400 },
    );
  }
}

// POST: Sync specifically selected users or trigger simulated automatic sync
export async function POST(request: NextRequest) {
  const authResponse = await requirePermission(PERMISSIONS.LDAP_SYNC);
  if (authResponse) return authResponse;

  try {
    const body = await request.json();
    const { usernamesToSync, action } = body;

    if (action === "simulate" || action === "full") {
      const now = new Date();
      // Run full sync (passing no argument syncs all LDAP users)
      const result = await syncLdapUsers();

      const settings = await prisma.systemSetting.findFirst();
      if (settings) {
        await prisma.systemSetting.update({
          where: { id: settings.id },
          data: {
            lastSyncAt: now,
            lastSyncStatus: "success",
            lastSyncMessage: `Successfully synchronized ${result.syncedCount} users (Created: ${result.usersCreated.length}, Updated: ${result.usersUpdated.length})`,
          },
        });
      }

      await logLdapSyncResult(result);

      return NextResponse.json({
        success: true,
        syncedCount: result.syncedCount,
        lastSyncAt: now.toISOString(),
        lastSyncStatus: "success",
        lastSyncMessage: `Successfully synchronized ${result.syncedCount} users`,
      });
    }

    if (!usernamesToSync || !Array.isArray(usernamesToSync)) {
      return NextResponse.json({ error: "Invalid payload. Expected 'usernamesToSync' array." }, { status: 400 });
    }

    const result = await syncLdapUsers(usernamesToSync);
    const syncedCount = result.syncedCount;

    await logLdapSyncResult(result);

    // Return all users from database for the UI list
    const dbUsers = await prisma.user.findMany({
      orderBy: { username: "asc" },
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
        department: true,
        company: true,
        employeeId: true,
        manager: true,
        lastSyncAt: true,
        disabled: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: dbUsers,
      syncedCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to synchronize data from LDAP";
    console.error("LDAP Sync Error:", error);

    // If it was a simulated action, update SystemSetting to failed state
    try {
      const settings = await prisma.systemSetting.findFirst();
      if (settings) {
        await prisma.systemSetting.update({
          where: { id: settings.id },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: "failed",
            lastSyncMessage: message,
          },
        });
      }
    } catch {}

    await logLdapSyncResult(null, message);

    return NextResponse.json(
      { error: message },
      { status: 400 },
    );
  }
}
