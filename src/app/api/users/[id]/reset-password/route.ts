import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { getServerTranslator } from "@/lib/i18n";
import { resetUserPassword } from "@/modules/users/services";

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

    await resetUserPassword(id, password);

    return NextResponse.json({
      success: true,
      message: t("usersPage.successResetPassword"),
    });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    if (rawMessage === "USER_NOT_FOUND") {
      return NextResponse.json({ error: t("errors.userNotFound") }, { status: 404 });
    }
    if (rawMessage === "CANNOT_RESET_PASSWORD_LDAP_USER") {
      return NextResponse.json({ error: t("errors.cannotResetPasswordLdapUser") }, { status: 400 });
    }
    if (rawMessage.startsWith("PASSWORD_VALIDATION_FAILED:")) {
      const errorJson = rawMessage.substring("PASSWORD_VALIDATION_FAILED:".length);
      const validationErrors = JSON.parse(errorJson) as { key: string; variables?: Record<string, string | number> }[];
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

    const message = t("errors.failedToResetPassword", { error: rawMessage });
    console.error(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
