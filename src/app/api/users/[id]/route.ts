import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/audit";
import { getServerTranslator } from "@/lib/i18n";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResponse = await requirePermission(PERMISSIONS.USERS_READ);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        companyObj: {
          select: {
            id: true,
            code: true,
            nameVi: true,
            nameEn: true,
          }
        },
        roles: {
          select: {
            id: true,
            name: true,
            isSystem: true,
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: t("errors.userNotFound") }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...userWithoutPassword } = user;

    return NextResponse.json({
      success: true,
      data: userWithoutPassword
    });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    return NextResponse.json(
      { error: t("errors.failedToFetchUsers", { error: rawMessage }) },
      { status: 500 }
    );
  }
}

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
    const {
      displayName,
      firstName,
      lastName,
      email,
      phone,
      title,
      department,
      companyId,
      disabled,
      roleIds,
    } = body;

    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: {
        companyObj: true,
        roles: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: t("errors.userNotFound") }, { status: 404 });
    }

    const isLdapUser = existingUser.dn !== "";

    // Check required fields (only for local users)
    if (!isLdapUser && (!displayName || !email)) {
      return NextResponse.json({ error: t("errors.missingRequiredFields") }, { status: 400 });
    }

    // Extract beforeState for log
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...userBefore } = existingUser;

    // Determine roles update payload
    let rolesUpdate = undefined;
    if (roleIds && Array.isArray(roleIds)) {
      rolesUpdate = {
        set: roleIds.map((rid: string) => ({ id: rid })),
      };
    }

    const updateData: Prisma.UserUpdateInput = {
      roles: rolesUpdate,
    };

    if (!isLdapUser) {
      updateData.displayName = displayName;
      updateData.firstName = firstName || "";
      updateData.lastName = lastName || "";
      updateData.email = email;
      updateData.phone = phone || "";
      updateData.title = title || "";
      updateData.department = department || "";
      updateData.companyObj = companyId ? { connect: { id: companyId } } : { disconnect: true };
      updateData.disabled = disabled !== undefined ? !!disabled : existingUser.disabled;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        companyObj: true,
        roles: {
          select: {
            id: true,
            name: true,
            isSystem: true,
          },
        },
      },
    });

    // Extract afterState for log
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: __, ...userAfter } = updatedUser;

    await logAction("user:update", existingUser.username, {
      status: "success",
      message: "auditLogsPage.messages.updateUserSuccess",
      data: {
        before: {
          ...userBefore,
          company: existingUser.companyObj?.code || "",
          roles: existingUser.roles.map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem })),
        },
        after: {
          ...userAfter,
          company: updatedUser.companyObj?.code || "",
          roles: updatedUser.roles.map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem })),
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...userAfter,
        company: updatedUser.companyObj?.code || "",
      },
    });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToUpdateUser", { error: rawMessage });
    console.error(error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
