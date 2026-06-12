import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/audit";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResponse = await requirePermission(PERMISSIONS.USERS_DELETE);
  if (authResponse) return authResponse;

  try {
    const { id } = await params;

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    await logAction("user:delete", existingUser.username, {
      before: {
        username: existingUser.username,
        displayName: existingUser.displayName,
        email: existingUser.email,
        title: existingUser.title,
        department: existingUser.department,
        company: existingUser.company,
      },
      after: null,
    });

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete user.";
    console.error("Delete User Error:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
