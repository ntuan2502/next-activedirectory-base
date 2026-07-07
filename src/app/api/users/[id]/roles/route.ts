import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { getServerTranslator } from "@/lib/i18n";
import { updateUserRoles } from "@/modules/users/services";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResponse = await requirePermission(PERMISSIONS.USERS_UPDATE);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const { id } = await params;
    const body = await request.json();
    const { roleIds } = body;

    if (!Array.isArray(roleIds)) {
      return NextResponse.json({ error: t("errors.roleIdsMustBeArray") }, { status: 400 });
    }

    const updatedUser = await updateUserRoles(id, roleIds);

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    if (rawMessage === "USER_NOT_FOUND") {
      return NextResponse.json({ error: t("errors.userNotFound") }, { status: 404 });
    }

    const message = t("errors.failedToUpdateUserRoles", { error: rawMessage });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
