import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { getServerTranslator } from "@/lib/i18n";
import { updateUserRoles } from "@/modules/users/services";
import { handleApiError } from "@/lib/errors";

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

    if (!roleIds || !Array.isArray(roleIds)) {
      return NextResponse.json({ error: t("errors.roleIdsMustBeArray") }, { status: 400 });
    }

    const updatedUser = await updateUserRoles(id, roleIds);

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (error: unknown) {
    return handleApiError(error, t, "errors.failedToUpdateUserRoles");
  }
}
