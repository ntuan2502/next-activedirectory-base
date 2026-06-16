import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { logAction } from "@/lib/audit";
import { getServerTranslator } from "@/lib/i18n";
import { validatePassword } from "@/lib/password-validation";

export async function PATCH(request: Request) {
  const session = await getSession();
  const { t } = await getServerTranslator();

  if (!session) {
    return NextResponse.json(
      { error: t("errors.notAuthenticated") },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { type, displayName, email, currentPassword, newPassword } = body;

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: t("errors.userNotFound") },
        { status: 404 },
      );
    }

    const isLocal = user.dn === "" || !user.dn;

    if (type === "profile") {
      if (!isLocal) {
        return NextResponse.json(
          { error: t("errors.profileSyncedFromAd") },
          { status: 400 },
        );
      }

      if (!displayName || !email) {
        return NextResponse.json(
          { error: t("errors.displayNameAndEmailRequired") },
          { status: 400 },
        );
      }

      // Check if email format is valid
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: t("errors.invalidEmailFormat") },
          { status: 400 },
        );
      }

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          displayName,
          email: email.toLowerCase(),
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash: _1, ...userWithoutPassword } = user;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash: _2, ...updatedUserWithoutPassword } = updatedUser;

      await logAction("user:update_profile", user.username, {
        status: "success",
        message: "auditLogsPage.messages.updateProfileSuccess",
        data: {
          before: userWithoutPassword,
          after: updatedUserWithoutPassword,
        },
      });

      return NextResponse.json({
        success: true,
        user: {
          displayName: updatedUser.displayName,
          email: updatedUser.email,
        },
      });
    }

    if (type === "password") {
      if (!isLocal) {
        await logAction("user:change_password", user.username, {
          status: "failed",
          message: "errors.passwordSyncedFromAd",
          data: null,
        });
        return NextResponse.json(
          { error: t("errors.passwordSyncedFromAd") },
          { status: 400 },
        );
      }

      if (!currentPassword || !newPassword) {
        await logAction("user:change_password", user.username, {
          status: "failed",
          message: "errors.passwordFieldsRequired",
          data: null,
        });
        return NextResponse.json(
          { error: t("errors.passwordFieldsRequired") },
          { status: 400 },
        );
      }

      // Password validation based on security settings
      const settings = await prisma.systemSetting.findFirst();
      if (settings) {
        const validationErrors = validatePassword(
          newPassword,
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
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          }
        );

        if (validationErrors.length > 0) {
          await logAction("user:change_password", user.username, {
            status: "failed",
            message: validationErrors[0].key,
            data: null,
          });
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

      // If user has a passwordHash, verify it
      if (user.passwordHash) {
        const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!passwordMatch) {
          await logAction("user:change_password", user.username, {
            status: "failed",
            message: "errors.incorrectCurrentPassword",
            data: null,
          });
          return NextResponse.json(
            { error: t("errors.incorrectCurrentPassword") },
            { status: 400 },
          );
        }
      }

      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newPasswordHash,
        },
      });

      await logAction("user:change_password", user.username, {
        status: "success",
        message: "auditLogsPage.messages.changePasswordSuccess",
        data: null,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: t("errors.invalidUpdateType") },
      { status: 400 },
    );
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToUpdateProfile", { error: rawMessage });
    console.error(error);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
