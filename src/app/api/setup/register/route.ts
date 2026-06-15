import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { logAction } from "@/lib/audit";
import { getServerTranslator } from "@/lib/i18n";

export async function POST(request: NextRequest) {
  const { t } = await getServerTranslator();
  try {
    // 1. Guard check: Ensure no users exist yet
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return NextResponse.json(
        { error: t("errors.initialSetupAlreadyCompleted") },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { username, displayName, email, password } = body;

    // Validation
    if (!username || !displayName || !email || !password) {
      return NextResponse.json({ error: t("errors.missingRequiredAdminRegistrationFields") }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: t("errors.passwordTooShort") }, { status: 400 });
    }

    // 2. Ensure Super Admin role exists in DB
    let superAdminRole = await prisma.role.findFirst({
      where: { isSystem: true, name: "Super Admin" },
    });

    if (!superAdminRole) {
      superAdminRole = await prisma.role.create({
        data: {
          name: "Super Admin",
          description: "Built-in system administrator with full access",
          permissions: '["*"]',
          isSystem: true,
        },
      });
    }

    // 3. Hash password and save local user
    const passwordHash = await bcrypt.hash(password, 12);
    const lowercaseUsername = username.toLowerCase();

    const createdUser = await prisma.user.create({
      data: {
        username: lowercaseUsername,
        displayName,
        email,
        passwordHash,
        dn: "", // Local user identifier
        disabled: false,
        lastLoginAt: new Date(),
        roles: {
          connect: { id: superAdminRole.id },
        },
      },
    });

    // 4. Log the action
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...userWithoutPassword } = createdUser;
    await logAction(
      "auth:initial_setup",
      lowercaseUsername,
      {
        status: "success",
        message: "auditLogsPage.messages.initialSetupSuccess",
        data: {
          before: null,
          after: {
            ...userWithoutPassword,
            role: "Super Admin",
          },
        },
      },
      {
        userId: createdUser.id,
        username: lowercaseUsername,
      }
    );

    return NextResponse.json({
      success: true,
      message: t("setupPage.successAdmin"),
      data: {
        userId: createdUser.id,
        username: lowercaseUsername,
      },
    });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToRegisterAdmin", { error: rawMessage });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
