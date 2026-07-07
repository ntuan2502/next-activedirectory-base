import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { getServerTranslator } from "@/lib/i18n";
import { bulkUserActions } from "@/modules/users/services";
import { handleApiError } from "@/lib/errors";
import { BulkUserActionsSchema } from "@/modules/users/schemas";

export async function POST(request: NextRequest) {
  const { t } = await getServerTranslator();
  try {
    const body = await request.json();
    const validatedData = BulkUserActionsSchema.parse(body);

    const { action, userIds } = validatedData;

    if (action === "delete") {
      const authResponse = await requirePermission(PERMISSIONS.USERS_DELETE);
      if (authResponse) return authResponse;
    } else if (action === "enable" || action === "disable") {
      const authResponse = await requirePermission(PERMISSIONS.USERS_UPDATE);
      if (authResponse) return authResponse;
    } else {
      return NextResponse.json({ error: t("errors.invalidAction") }, { status: 400 });
    }

    await bulkUserActions(action, userIds);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, t, "errors.failedBulkAction");
  }
}
