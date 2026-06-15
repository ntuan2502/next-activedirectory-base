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
    });

    const usersBefore = affectedUsers.map((u) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...rest } = u;
      return rest;
    });

    if (action === "delete") {
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
      await logAction("users:bulk_delete", null, {
        status: "success",
        message: "auditLogsPage.messages.bulkDeleteUsersSuccess",
        data: {
          before: usersBefore,
          after: null,
        },
      });
    } else if (action === "disable") {
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { disabled: true },
      });
      const usersAfter = usersBefore.map((u) => ({ ...u, disabled: true }));
      await logAction("users:bulk_disable", null, {
        status: "success",
        message: "auditLogsPage.messages.bulkDisableUsersSuccess",
        data: {
          before: usersBefore,
          after: usersAfter,
        },
      });
    } else if (action === "enable") {
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { disabled: false },
      });
      const usersAfter = usersBefore.map((u) => ({ ...u, disabled: false }));
      await logAction("users:bulk_enable", null, {
        status: "success",
        message: "auditLogsPage.messages.bulkEnableUsersSuccess",
        data: {
          before: usersBefore,
          after: usersAfter,
        },
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
