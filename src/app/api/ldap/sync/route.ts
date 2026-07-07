import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/modules/audit-logs/services";
import { fetchLdapUsers, syncLdapUsers, logLdapSyncResult } from "@/modules/ldap/services";
import { getServerTranslator } from "@/lib/i18n";

export const dynamic = "force-dynamic";

// GET: Return a preview of LDAP users
export async function GET() {
  const authResponse = await requirePermission(PERMISSIONS.LDAP_SYNC);
  if (authResponse) return authResponse;

  try {
    const ldapUsers = await fetchLdapUsers();

    await logAction("ldap:fetch_data", null, {
      status: "success",
      message: "auditLogsPage.messages.ldapFetchSuccess",
      data: { count: ldapUsers.length },
    });

    return NextResponse.json({
      success: true,
      data: ldapUsers,
    });
  } catch (error: unknown) {
    const { t } = await getServerTranslator();
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToSyncLdap", { error: rawMessage });
    console.error(error);

    await logAction("ldap:fetch_data", null, {
      status: "failed",
      message: "errors.ldapFetchFailed",
      data: { error: rawMessage },
    });

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

  const { t } = await getServerTranslator();
  try {
    const body = await request.json();
    const { usernamesToSync, action } = body;

    if (action === "simulate" || action === "full") {
      const now = new Date();
      const result = await syncLdapUsers();

      const settings = await prisma.systemSetting.findFirst();
      if (settings) {
        await prisma.systemSetting.update({
          where: { id: settings.id },
          data: {
            lastSyncAt: now,
            lastSyncStatus: "success",
            lastSyncMessage: t("setupPage.syncSuccessCount", {
              count: result.syncedCount,
              created: result.usersCreated.length,
              updated: result.usersUpdated.length,
            }),
          },
        });
      }

      await logLdapSyncResult(result);

      return NextResponse.json({
        success: true,
        syncedCount: result.syncedCount,
        lastSyncAt: now.toISOString(),
        lastSyncStatus: "success",
        lastSyncMessage: t("setupPage.syncSuccess", {
          count: result.syncedCount,
        }),
      });
    }

    if (!usernamesToSync || !Array.isArray(usernamesToSync)) {
      return NextResponse.json({ error: t("errors.invalidPayloadSync") }, { status: 400 });
    }

    const result = await syncLdapUsers(usernamesToSync);
    const syncedCount = result.syncedCount;

    await logLdapSyncResult(result);

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
        employeeId: true,
        manager: true,
        lastSyncAt: true,
        disabled: true,
      },
    });

    const formattedUsers = dbUsers.map((user) => {
      const { companies, departments, ...rest } = user;
      return {
        ...rest,
        company: companies.map((c) => c.code).join(", "),
        department: departments.map((d) => d.nameVi || d.nameEn).join(", "),
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedUsers,
      syncedCount,
    });
  } catch (error: unknown) {
    const { t } = await getServerTranslator();
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToSyncLdap", { error: rawMessage });
    console.error(error);

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

    await logLdapSyncResult(null, {
      key: "errors.failedToSyncLdap",
      params: { error: rawMessage },
    });

    return NextResponse.json(
      { error: message },
      { status: 400 },
    );
  }
}
