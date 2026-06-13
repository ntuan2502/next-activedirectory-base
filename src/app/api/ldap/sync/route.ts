import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/audit";
import { fetchLdapUsers, syncLdapUsers } from "@/lib/sync-core";

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

// POST: Sync specifically selected users
export async function POST(request: NextRequest) {
  const authResponse = await requirePermission(PERMISSIONS.LDAP_SYNC);
  if (authResponse) return authResponse;

  try {
    const body = await request.json();
    const { usernamesToSync } = body;

    if (!usernamesToSync || !Array.isArray(usernamesToSync)) {
      return NextResponse.json({ error: "Invalid payload. Expected 'usernamesToSync' array." }, { status: 400 });
    }

    const { syncedCount } = await syncLdapUsers(usernamesToSync);

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
    return NextResponse.json(
      { error: message },
      { status: 400 },
    );
  }
}
