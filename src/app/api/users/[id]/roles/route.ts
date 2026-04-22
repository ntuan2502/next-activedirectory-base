import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResponse = await requirePermission(PERMISSIONS.USERS_WRITE);
  if (authResponse) return authResponse;

  try {
    const { id } = await params;
    const body = await request.json();
    const { roleIds } = body;

    if (!Array.isArray(roleIds)) {
      return NextResponse.json({ error: "roleIds must be an array" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: { roles: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
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

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update user roles.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
