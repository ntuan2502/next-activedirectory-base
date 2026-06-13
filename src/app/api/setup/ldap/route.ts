import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logAction } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    // 1. Guard check: Ensure at least one admin exists
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      return NextResponse.json(
        { error: "Please register a system administrator first." },
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
        syncEnabled: false,
        syncInterval: 1440,
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

      await logAction("settings:initial_setup_skip", "system", {
        message: "LDAP configuration skipped during initial setup",
      });

      return NextResponse.json({
        success: true,
        message: "LDAP configuration skipped",
        data: updatedSettings,
      });
    }

    // Process actual configuration
    if (!ldapUrl || !ldapBindDn || !ldapBaseDn) {
      return NextResponse.json(
        { error: "Missing required LDAP settings fields" },
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
      syncEnabled: false,
      syncInterval: 1440,
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
    await logAction("settings:initial_setup_ldap", "system", {
      ldapUrl,
      ldapPort: portNumber,
      ldapBindDn,
      ldapBaseDn,
      ldapFilter: dataPayload.ldapFilter,
    });

    return NextResponse.json({
      success: true,
      message: "LDAP settings configured successfully",
      data: updatedSettings,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to configure initial LDAP settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
