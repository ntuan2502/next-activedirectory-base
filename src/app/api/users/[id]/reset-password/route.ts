import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { getServerTranslator } from "@/lib/i18n";
import { resetUserPassword } from "@/modules/users/services";
import { handleApiError } from "@/lib/errors";
import { ResetPasswordSchema } from "@/modules/users/schemas";
import { passwordResetLimiter } from "@/lib/rate-limiter";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResponse = await requirePermission(PERMISSIONS.USERS_UPDATE);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  if (await passwordResetLimiter.isRateLimited(ip)) {
    return NextResponse.json({ error: t("errors.rateLimitExceeded") }, { status: 429 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = ResetPasswordSchema.parse(body);

    await resetUserPassword(id, validatedData.password);

    return NextResponse.json({
      success: true,
      message: t("usersPage.successResetPassword"),
    });
  } catch (error: unknown) {
    return handleApiError(error, t, "errors.failedToResetPassword");
  }
}
