import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authResponse = await requirePermission(PERMISSIONS.USERS_READ);
  if (authResponse) return authResponse;

  try {
    const users = await prisma.user.findMany({
      orderBy: { username: "asc" },
      select: {
        id: true,
        username: true,
        displayName: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        title: true,
        department: true,
        disabled: true,
        roles: {
          select: {
            id: true,
            name: true,
            isSystem: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch users.";
    console.error("Users API Error:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
