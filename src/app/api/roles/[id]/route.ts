import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/audit";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResponse = await requirePermission(PERMISSIONS.ROLES_UPDATE);
  if (authResponse) return authResponse;

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, permissions } = body;

    const existingRole = await prisma.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      return NextResponse.json({ error: "Role not found." }, { status: 404 });
    }

    if (existingRole.isSystem) {
      return NextResponse.json({ error: "System roles cannot be modified." }, { status: 400 });
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
        name: existingRole.name,
        description: existingRole.description,
        permissions: JSON.parse(existingRole.permissions || "[]"),
      },
      after: {
        name: role.name,
        description: role.description,
        permissions: JSON.parse(role.permissions || "[]"),
      },
    });

    return NextResponse.json({ success: true, data: role });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update role.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResponse = await requirePermission(PERMISSIONS.ROLES_DELETE);
  if (authResponse) return authResponse;

  try {
    const { id } = await params;

    const existingRole = await prisma.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      return NextResponse.json({ error: "Role not found." }, { status: 404 });
    }

    if (existingRole.isSystem) {
      return NextResponse.json({ error: "System roles cannot be deleted." }, { status: 400 });
    }

    await logAction("role:delete", existingRole.name, {
      before: {
        name: existingRole.name,
        description: existingRole.description,
        permissions: JSON.parse(existingRole.permissions || "[]"),
      },
      after: null,
    });

    await prisma.role.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete role.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
