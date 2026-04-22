import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  const authResponse = await requirePermission("users:write");
  if (authResponse) return authResponse;

  try {
    const body = await request.json();
    const { action, userIds } = body;

    if (!action || !userIds || !Array.isArray(userIds)) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    if (userIds.length === 0) {
      return NextResponse.json({ error: "No users selected." }, { status: 400 });
    }

    if (action === "delete") {
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    } else if (action === "disable") {
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { disabled: true },
      });
    } else if (action === "enable") {
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { disabled: false },
      });
    } else {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Bulk action failed.";
    console.error("Bulk Action Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
