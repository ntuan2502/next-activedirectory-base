import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { getServerTranslator } from "@/lib/i18n";
import { bulkUserActions } from "@/modules/users/services";

export async function POST(request: NextRequest) {
  const { t } = await getServerTranslator();
  try {
    const body = await request.json();
    const { action, userIds } = body;

    if (!action || !userIds || !Array.isArray(userIds)) {
      return NextResponse.json({ error: t("errors.invalidPayload") }, { status: 400 });
    }

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
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    if (rawMessage === "NO_USERS_SELECTED") {
      return NextResponse.json({ error: t("errors.noUsersSelected") }, { status: 400 });
    }

    const message = t("errors.failedBulkAction", { error: rawMessage });
    console.error(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
