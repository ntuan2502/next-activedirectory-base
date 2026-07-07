import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { getServerTranslator } from "@/lib/i18n";
import { getRoleById, updateRole, deleteRole } from "@/modules/roles/services";

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
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    return NextResponse.json({ error: rawMessage }, { status: 500 });
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
    const { name, description, permissions } = body;

    const role = await updateRole(id, { name, description, permissions });

    return NextResponse.json({ success: true, data: role });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    if (rawMessage === "ROLE_NOT_FOUND") {
      return NextResponse.json({ error: t("errors.roleNotFound") }, { status: 404 });
    }
    if (rawMessage === "SYSTEM_ROLE_NOT_MODIFIED") {
      return NextResponse.json({ error: t("errors.systemRoleNotModified") }, { status: 400 });
    }

    const message = t("errors.failedToUpdateRole", { error: rawMessage });
    return NextResponse.json({ error: message }, { status: 500 });
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
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    if (rawMessage === "ROLE_NOT_FOUND") {
      return NextResponse.json({ error: t("errors.roleNotFound") }, { status: 404 });
    }
    if (rawMessage === "SYSTEM_ROLE_NOT_DELETED") {
      return NextResponse.json({ error: t("errors.systemRoleNotDeleted") }, { status: 400 });
    }
    if (rawMessage === "CANNOT_DELETE_ROLE_HAS_USERS") {
      return NextResponse.json({ error: t("errors.cannotDeleteRoleHasUsers") }, { status: 400 });
    }

    const message = t("errors.failedToDeleteRole", { error: rawMessage });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
