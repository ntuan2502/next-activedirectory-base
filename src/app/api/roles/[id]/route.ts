import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/audit";
import { sseManager } from "@/lib/sse";
import { getServerTranslator } from "@/lib/i18n";

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

    const existingRole = await prisma.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      return NextResponse.json({ error: t("errors.roleNotFound") }, { status: 404 });
    }

    if (existingRole.isSystem) {
      return NextResponse.json({ error: t("errors.systemRoleNotModified") }, { status: 400 });
    }

    const updateData: { name?: string; description?: string | null; permissions?: string } = {
      name,
      description,
      permissions: JSON.stringify(permissions || []),
    };

    const role = await prisma.role.update({
      where: { id },
      data: updateData,
    });

    await logAction("role:update", role.name, {
      before: {
        ...existingRole,
        permissions: JSON.parse(existingRole.permissions || "[]"),
      },
      after: {
        ...role,
        permissions: JSON.parse(role.permissions || "[]"),
      },
    });

    const roleWithUsers = await prisma.role.findUnique({
      where: { id },
      select: {
        users: {
          select: { id: true },
        },
      },
    });

    if (roleWithUsers?.users) {
      for (const u of roleWithUsers.users) {
        sseManager.publish({
          userId: u.id,
          type: "PERMISSIONS_UPDATED",
        });
      }
    }

    return NextResponse.json({ success: true, data: role });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
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

    const existingRole = await prisma.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      return NextResponse.json({ error: t("errors.roleNotFound") }, { status: 404 });
    }

    if (existingRole.isSystem) {
      return NextResponse.json({ error: t("errors.systemRoleNotDeleted") }, { status: 400 });
    }

    await logAction("role:delete", existingRole.name, {
      before: {
        ...existingRole,
        permissions: JSON.parse(existingRole.permissions || "[]"),
      },
      after: null,
    });

    await prisma.role.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToDeleteRole", { error: rawMessage });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
