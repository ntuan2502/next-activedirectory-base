import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/audit";
import { checkAndRunSync } from "@/lib/scheduler";
import { getServerTranslator } from "@/lib/i18n";

export const dynamic = "force-dynamic";

// GET: Retrieve system settings (excluding actual password values)
export async function GET() {
  const authResponse = await requirePermission(PERMISSIONS.LDAP_SYNC);
  if (authResponse) return authResponse;

  try {
    const settings = await prisma.systemSetting.findFirst();

    if (!settings) {
      // Return clean initial values since env variables have been removed
      return NextResponse.json({
        success: true,
        data: {
          ldapUrl: "",
          ldapPort: "",
          ldapBindDn: "",
          ldapBindPassword: "", // Keep password empty
          ldapBaseDn: "",
          ldapFilter: "",
          syncEnabled: false,
          syncInterval: 1440,
          lastSyncAt: null,
          lastSyncStatus: "none",
          lastSyncMessage: "",
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        ldapUrl: settings.ldapUrl || "",
        ldapPort: settings.ldapPort,
        ldapBindDn: settings.ldapBindDn || "",
        ldapBindPassword: "", // Do not return password to client
        ldapBaseDn: settings.ldapBaseDn || "",
        ldapFilter: settings.ldapFilter || "",
        syncEnabled: settings.syncEnabled,
        syncInterval: settings.syncInterval,
        lastSyncAt: settings.lastSyncAt,
        lastSyncStatus: settings.lastSyncStatus,
        lastSyncMessage: settings.lastSyncMessage,
      },
    });
  } catch (error: unknown) {
    const { t } = await getServerTranslator();
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToRetrieveSettings", { error: rawMessage });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// POST: Save/Update system settings
export async function POST(request: NextRequest) {
  const authResponse = await requirePermission(PERMISSIONS.LDAP_SYNC);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const body = await request.json();
    const {
      ldapUrl,
      ldapPort,
      ldapBindDn,
      ldapBindPassword,
      ldapBaseDn,
      ldapFilter,
      syncEnabled,
      syncInterval,
    } = body;

    // Validate inputs
    if (!ldapUrl || !ldapBindDn || !ldapBaseDn) {
      return NextResponse.json({ error: t("errors.missingRequiredLdapSettingsFields") }, { status: 400 });
    }

    const portNumber = ldapPort ? parseInt(ldapPort, 10) : null;
    const intervalNumber = Math.max(1, parseInt(syncInterval || "1440", 10));

    // Retrieve existing record
    const existing = await prisma.systemSetting.findFirst();

    let passwordToSave = ldapBindPassword;
    if (!passwordToSave) {
      passwordToSave = existing ? (existing.ldapBindPassword || "") : (process.env.LDAP_PASSWORD || "");
    }

    const dataPayload = {
      ldapUrl,
      ldapPort: portNumber,
      ldapBindDn,
      ldapBindPassword: passwordToSave,
      ldapBaseDn,
      ldapFilter: ldapFilter || null,
      syncEnabled: !!syncEnabled,
      syncInterval: intervalNumber,
    };

    let updatedSettings;
    if (existing) {
      updatedSettings = await prisma.systemSetting.update({
        where: { id: existing.id },
        data: dataPayload,
      });
    } else {
      updatedSettings = await prisma.systemSetting.create({
        data: {
          id: "default",
          ...dataPayload,
        },
      });
    }

    // Prepare before and after states (exclude password for security)
    let beforeState = null;
    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { ldapBindPassword: _, ...settingsWithoutPassword } = existing;
      beforeState = settingsWithoutPassword;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ldapBindPassword: _, ...settingsWithoutPassword } = updatedSettings;
    const afterState = settingsWithoutPassword;

    // Log the action
    await logAction("settings:update", "system", {
      before: beforeState,
      after: afterState,
    });

    // Trigger immediate background sync check if enabled
    if (updatedSettings.syncEnabled) {
      checkAndRunSync().catch((err) => {
        console.error(err);
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        ldapUrl: updatedSettings.ldapUrl,
        ldapPort: updatedSettings.ldapPort,
        ldapBindDn: updatedSettings.ldapBindDn,
        ldapBindPassword: "",
        ldapBaseDn: updatedSettings.ldapBaseDn,
        ldapFilter: updatedSettings.ldapFilter,
        syncEnabled: updatedSettings.syncEnabled,
        syncInterval: updatedSettings.syncInterval,
        lastSyncAt: updatedSettings.lastSyncAt,
        lastSyncStatus: updatedSettings.lastSyncStatus,
        lastSyncMessage: updatedSettings.lastSyncMessage,
      },
    });
  } catch (error: unknown) {
    const { t } = await getServerTranslator();
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToUpdateSettings", { error: rawMessage });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
