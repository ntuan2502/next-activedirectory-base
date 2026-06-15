import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAction } from "@/lib/audit";
import { getServerTranslator } from "@/lib/i18n";

export async function POST(request: NextRequest) {
  const { t } = await getServerTranslator();
  try {
    // 1. Guard check: Ensure at least one admin exists
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      return NextResponse.json(
        { error: t("errors.registerAdminFirst") },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      skip,
      ldapUrl,
      ldapPort,
      ldapBindDn,
      ldapBindPassword,
      ldapBaseDn,
      ldapFilter,
    } = body;

    // Check if system setting already exists
    const existing = await prisma.systemSetting.findFirst();
    let updatedSettings;

    if (skip) {
      // Create empty/inactive settings when skipping
      const skipPayload = {
        ldapUrl: null,
        ldapPort: null,
        ldapBindDn: null,
        ldapBindPassword: null,
        ldapBaseDn: null,
        ldapFilter: null,
      };

      if (existing) {
        updatedSettings = await prisma.systemSetting.update({
          where: { id: existing.id },
          data: skipPayload,
        });
      } else {
        updatedSettings = await prisma.systemSetting.create({
          data: {
            id: "default",
            ...skipPayload,
          },
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { ldapBindPassword: _, ...settingsWithoutPassword } = updatedSettings;
      await logAction("settings:initial_setup_skip", "system", {
        before: null,
        after: settingsWithoutPassword,
      });

      return NextResponse.json({
        success: true,
        message: t("setupPage.successSkip"),
        data: updatedSettings,
      });
    }

    // Process actual configuration
    if (!ldapUrl || !ldapBindDn || !ldapBaseDn) {
      return NextResponse.json(
        { error: t("errors.missingRequiredLdapSettingsFields") },
        { status: 400 }
      );
    }

    const portNumber = ldapPort ? parseInt(ldapPort, 10) : null;
    const dataPayload = {
      ldapUrl,
      ldapPort: portNumber,
      ldapBindDn,
      ldapBindPassword: ldapBindPassword || null,
      ldapBaseDn,
      ldapFilter: ldapFilter || null,
    };

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

    // Log the action
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ldapBindPassword: _, ...settingsWithoutPassword } = updatedSettings;
    await logAction("settings:initial_setup_ldap", "system", {
      before: null,
      after: settingsWithoutPassword,
    });

    return NextResponse.json({
      success: true,
      message: t("setupPage.successLdap"),
      data: updatedSettings,
    });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToConfigureLdap", { error: rawMessage });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
