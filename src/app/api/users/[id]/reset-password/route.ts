import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import bcrypt from "bcryptjs";
import { logAction } from "@/lib/audit";
import { validatePassword } from "@/lib/password-validation";
import { getServerTranslator } from "@/lib/i18n";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResponse = await requirePermission(PERMISSIONS.USERS_UPDATE);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const { id } = await params;
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: t("errors.passwordRequired") },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: t("errors.userNotFound") },
        { status: 404 }
      );
    }

    // Only allow resetting password for local users
    if (existingUser.dn !== "") {
      return NextResponse.json(
        { error: t("errors.cannotResetPasswordLdapUser") },
        { status: 400 }
      );
    }

    // Password validation based on security settings
    const settings = await prisma.systemSetting.findFirst();
    if (settings) {
      const validationErrors = validatePassword(
        password,
        {
          passwordMinLength: settings.passwordMinLength,
          passwordPreventCommon: settings.passwordPreventCommon,
          passwordNoUserInfo: settings.passwordNoUserInfo,
          passwordRequireLetter: settings.passwordRequireLetter,
          passwordRequireNumber: settings.passwordRequireNumber,
          passwordRequireSymbol: settings.passwordRequireSymbol,
          passwordRequireMixedCase: settings.passwordRequireMixedCase,
        },
        {
          username: existingUser.username,
          email: existingUser.email,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
        }
      );

      if (validationErrors.length > 0) {
        return NextResponse.json(
          {
            error: t(validationErrors[0].key, validationErrors[0].variables),
            validationErrors: validationErrors.map((err) => ({
              message: t(err.key, err.variables) || err.key,
              key: err.key,
            })),
          },
          { status: 400 }
        );
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    // Write audit log
    await logAction("user:change_password", existingUser.username, {
      status: "success",
      message: "auditLogsPage.details.passwordUpdatedSuccessfully",
      data: null,
    });

    return NextResponse.json({
      success: true,
      message: t("usersPage.successResetPassword"),
    });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToResetPassword", { error: rawMessage });
    console.error(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
