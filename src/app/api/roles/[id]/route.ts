import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { getServerTranslator } from "@/lib/i18n";
import { getRoleById, updateRole, deleteRole } from "@/modules/roles/services";
import { handleApiError } from "@/lib/errors";
import { UpdateRoleSchema } from "@/modules/roles/schemas";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResponse = await requirePermission(PERMISSIONS.ROLES_READ);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const { id } = await params;
    const role = await getRoleById(id);

    if (!role) {
      return NextResponse.json({ error: t("errors.roleNotFound") }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: role });
  } catch (error: unknown) {
    return handleApiError(error, t, "errors.failedToFetchRoles");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResponse = await requirePermission(PERMISSIONS.ROLES_UPDATE);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = UpdateRoleSchema.parse(body);

    const role = await updateRole(id, validatedData);

    return NextResponse.json({ success: true, data: role });
  } catch (error: unknown) {
    return handleApiError(error, t, "errors.failedToUpdateRole");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResponse = await requirePermission(PERMISSIONS.ROLES_DELETE);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const { id } = await params;
    await deleteRole(id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, t, "errors.failedToDeleteRole");
  }
}
