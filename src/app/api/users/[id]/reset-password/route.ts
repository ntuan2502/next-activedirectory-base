import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { getServerTranslator } from "@/lib/i18n";
import { resetUserPassword } from "@/modules/users/services";
import { handleApiError } from "@/lib/errors";

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
    return handleApiError(error, t, "errors.failedToResetPassword");
  }
}
