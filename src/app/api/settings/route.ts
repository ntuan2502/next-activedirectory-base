import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/modules/audit-logs/services";
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
          passwordMinLength: 8,
          passwordPreventCommon: false,
          passwordNoUserInfo: false,
          passwordRequireLetter: false,
          passwordRequireNumber: false,
          passwordRequireSymbol: false,
          passwordRequireMixedCase: false,
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
        passwordMinLength: settings.passwordMinLength,
        passwordPreventCommon: settings.passwordPreventCommon,
        passwordNoUserInfo: settings.passwordNoUserInfo,
        passwordRequireLetter: settings.passwordRequireLetter,
        passwordRequireNumber: settings.passwordRequireNumber,
        passwordRequireSymbol: settings.passwordRequireSymbol,
        passwordRequireMixedCase: settings.passwordRequireMixedCase,
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
      updateType,
      ldapUrl,
      ldapPort,
      ldapBindDn,
      ldapBindPassword,
      ldapBaseDn,
      ldapFilter,
      syncEnabled,
      syncInterval,
      passwordMinLength,
      passwordPreventCommon,
      passwordNoUserInfo,
      passwordRequireLetter,
      passwordRequireNumber,
      passwordRequireSymbol,
      passwordRequireMixedCase,
    } = body;

    const existing = await prisma.systemSetting.findFirst();

    let dataPayload: Prisma.SystemSettingCreateInput = {};

    if (updateType === "security") {
      dataPayload = {
        passwordMinLength: passwordMinLength ? Math.max(8, parseInt(passwordMinLength, 10)) : 8,
        passwordPreventCommon: !!passwordPreventCommon,
        passwordNoUserInfo: !!passwordNoUserInfo,
        passwordRequireLetter: !!passwordRequireLetter,
        passwordRequireNumber: !!passwordRequireNumber,
        passwordRequireSymbol: !!passwordRequireSymbol,
        passwordRequireMixedCase: !!passwordRequireMixedCase,
      };
    } else {
      // Validate inputs for LDAP sync settings
      if (!ldapUrl || !ldapBindDn || !ldapBaseDn) {
        return NextResponse.json({ error: t("errors.missingRequiredLdapSettingsFields") }, { status: 400 });
      }

      const portNumber = ldapPort ? parseInt(ldapPort, 10) : null;
      const intervalNumber = Math.max(1, parseInt(syncInterval || "1440", 10));

      let passwordToSave = ldapBindPassword;
      if (!passwordToSave) {
        passwordToSave = existing ? (existing.ldapBindPassword || "") : (process.env.LDAP_PASSWORD || "");
      }

      dataPayload = {
        ldapUrl,
        ldapPort: portNumber,
        ldapBindDn,
        ldapBindPassword: passwordToSave,
        ldapBaseDn,
        ldapFilter: ldapFilter || null,
        syncEnabled: !!syncEnabled,
        syncInterval: intervalNumber,
      };
    }

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
    await logAction("settings:update", null, {
      status: "success",
      message: "auditLogsPage.messages.updateSystemSettingsSuccess",
      data: {
        before: beforeState,
        after: afterState,
      },
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
        passwordMinLength: updatedSettings.passwordMinLength,
        passwordPreventCommon: updatedSettings.passwordPreventCommon,
        passwordNoUserInfo: updatedSettings.passwordNoUserInfo,
        passwordRequireLetter: updatedSettings.passwordRequireLetter,
        passwordRequireNumber: updatedSettings.passwordRequireNumber,
        passwordRequireSymbol: updatedSettings.passwordRequireSymbol,
        passwordRequireMixedCase: updatedSettings.passwordRequireMixedCase,
      },
    });
  } catch (error: unknown) {
    const { t } = await getServerTranslator();
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToUpdateSettings", { error: rawMessage });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
