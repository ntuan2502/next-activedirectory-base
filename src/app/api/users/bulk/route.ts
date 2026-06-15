import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/audit";
import { getServerTranslator } from "@/lib/i18n";

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

    if (userIds.length === 0) {
      return NextResponse.json({ error: t("errors.noUsersSelected") }, { status: 400 });
    }

    const affectedUsers = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, disabled: true }
    });

    if (action === "delete") {
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
      await logAction("users:bulk_delete", `${userIds.length} users`, {
        before: affectedUsers.map((u) => ({ id: u.id, username: u.username })),
        after: null,
      });
    } else if (action === "disable") {
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { disabled: true },
      });
      await logAction("users:bulk_disable", `${userIds.length} users`, {
        before: affectedUsers.map((u) => ({ id: u.id, username: u.username, disabled: u.disabled })),
        after: affectedUsers.map((u) => ({ id: u.id, username: u.username, disabled: true })),
      });
    } else if (action === "enable") {
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { disabled: false },
      });
      await logAction("users:bulk_enable", `${userIds.length} users`, {
        before: affectedUsers.map((u) => ({ id: u.id, username: u.username, disabled: u.disabled })),
        after: affectedUsers.map((u) => ({ id: u.id, username: u.username, disabled: false })),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedBulkAction", { error: rawMessage });
    console.error(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
