import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/audit";

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
          ldapPort: 389,
          ldapBindDn: "",
          ldapBindPassword: "", // Keep password empty
          ldapBaseDn: "",
          ldapFilter: "(&(objectCategory=person)(objectClass=user))",
          syncEnabled: false,
          syncInterval: 24,
          lastSyncAt: null,
          lastSyncStatus: "none",
          lastSyncMessage: "",
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        ldapUrl: settings.ldapUrl,
        ldapPort: settings.ldapPort,
        ldapBindDn: settings.ldapBindDn,
        ldapBindPassword: "", // Do not return password to client
        ldapBaseDn: settings.ldapBaseDn,
        ldapFilter: settings.ldapFilter,
        syncEnabled: settings.syncEnabled,
        syncInterval: settings.syncInterval,
        lastSyncAt: settings.lastSyncAt,
        lastSyncStatus: settings.lastSyncStatus,
        lastSyncMessage: settings.lastSyncMessage,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve system settings";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// POST: Save/Update system settings
export async function POST(request: NextRequest) {
  const authResponse = await requirePermission(PERMISSIONS.LDAP_SYNC);
  if (authResponse) return authResponse;

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
      return NextResponse.json({ error: "Missing required LDAP settings fields" }, { status: 400 });
    }

    const portNumber = parseInt(ldapPort || "389", 10);
    const intervalNumber = Math.max(1, parseInt(syncInterval || "24", 10));

    // Retrieve existing record
    const existing = await prisma.systemSetting.findFirst();

    let passwordToSave = ldapBindPassword;
    if (!passwordToSave || passwordToSave === "********") {
      passwordToSave = existing ? existing.ldapBindPassword : (process.env.LDAP_PASSWORD || "");
    }

    const dataPayload = {
      ldapUrl,
      ldapPort: portNumber,
      ldapBindDn,
      ldapBindPassword: passwordToSave,
      ldapBaseDn,
      ldapFilter: ldapFilter || "(&(objectCategory=person)(objectClass=user))",
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

    // Prepare before state (exclude password for security)
    const beforeState = existing ? {
      ldapUrl: existing.ldapUrl,
      ldapPort: existing.ldapPort,
      ldapBindDn: existing.ldapBindDn,
      ldapBaseDn: existing.ldapBaseDn,
      ldapFilter: existing.ldapFilter,
      syncEnabled: existing.syncEnabled,
      syncInterval: existing.syncInterval,
    } : null;

    // Prepare after state
    const afterState = {
      ldapUrl,
      ldapPort: portNumber,
      ldapBindDn,
      ldapBaseDn,
      ldapFilter: dataPayload.ldapFilter,
      syncEnabled: !!syncEnabled,
      syncInterval: intervalNumber,
    };

    // Log the action
    await logAction("settings:update", "system", {
      before: beforeState,
      after: afterState,
    });

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
    const message = error instanceof Error ? error.message : "Failed to update system settings";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
