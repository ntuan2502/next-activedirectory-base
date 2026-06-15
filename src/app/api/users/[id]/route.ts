import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/audit";
import { getServerTranslator } from "@/lib/i18n";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResponse = await requirePermission(PERMISSIONS.USERS_DELETE);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const { id } = await params;

    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: {
        companyObj: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: t("errors.userNotFound") }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...userWithoutPassword } = existingUser;
    await logAction("user:delete", existingUser.username, {
      status: "success",
      message: "auditLogsPage.messages.deleteUserSuccess",
      data: {
        before: {
          ...userWithoutPassword,
          company: existingUser.companyObj?.code || "",
        },
        after: null,
      },
    });

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToDeleteUser", { error: rawMessage });
    console.error(error);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
