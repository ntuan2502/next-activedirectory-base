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

    const user = await prisma.user.findUnique({
      where: { id },
      include: { roles: true }
    });

    if (!user) {
      return NextResponse.json({ error: t("errors.userNotFound") }, { status: 404 });
    }

    // Protect super admin role from being removed from the last super admin user if needed,
    // but for simplicity, we just allow updating roles.

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        roles: {
          set: roleIds.map((roleId: string) => ({ id: roleId })),
        },
      },
      include: {
        roles: {
          select: { id: true, name: true, isSystem: true }
        }
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _1, ...userWithoutPassword } = user;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _2, ...updatedUserWithoutPassword } = updatedUser;

    await logAction("user:update_roles", user.username, {
      status: "success",
      message: "auditLogsPage.messages.updateUserRolesSuccess",
      data: {
        before: userWithoutPassword,
        after: updatedUserWithoutPassword,
      },
    });

    sseManager.publish({
      userId: updatedUser.id,
      type: "PERMISSIONS_UPDATED",
    });

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToUpdateUserRoles", { error: rawMessage });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
