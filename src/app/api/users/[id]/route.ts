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
        companies: {
          select: {
            id: true,
            code: true,
            nameVi: true,
            nameEn: true,
          }
        },
        departments: {
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
    const { passwordHash, companies, departments, ...rest } = user;
    const userWithoutPassword = {
      ...rest,
      companyIds: user.companies.map((c) => c.id),
      departmentIds: user.departments.map((d) => d.id),
      companyId: user.companies[0]?.id || "",
      department: user.departments[0]?.nameVi || user.departments[0]?.nameEn || "",
    };

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
        companies: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: t("errors.userNotFound") }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, companies, ...userWithoutPassword } = existingUser;
    await logAction("user:delete", existingUser.username, {
      status: "success",
      message: "auditLogsPage.messages.deleteUserSuccess",
      data: {
        before: {
          ...userWithoutPassword,
          company: existingUser.companies[0]?.code || "",
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
      companyId,
      companyIds,
      departmentIds,
      disabled,
      roleIds,
    } = body;

    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: {
        companies: true,
        departments: true,
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
    const { passwordHash: _, companies, departments, ...userBefore } = existingUser;

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
      updateData.disabled = disabled !== undefined ? !!disabled : existingUser.disabled;
    }

    // Luôn cho phép cập nhật công ty (kể cả tài khoản AD sync)
    if (companyIds !== undefined || companyId !== undefined) {
      const finalCompanyIds: string[] = companyIds && Array.isArray(companyIds)
        ? companyIds
        : (companyId ? [companyId] : []);

      updateData.companies = {
        set: finalCompanyIds.map((cid: string) => ({ id: cid }))
      };
    }

    // Luôn cho phép cập nhật phòng ban (kể cả tài khoản AD sync)
    if (departmentIds !== undefined) {
      const finalDepartmentIds: string[] = departmentIds && Array.isArray(departmentIds)
        ? departmentIds
        : [];

      updateData.departments = {
        set: finalDepartmentIds.map((did: string) => ({ id: did }))
      };
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        companies: true,
        departments: true,
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
    const { passwordHash: __, companies: _c, departments: _d, ...userAfter } = updatedUser;

    await logAction("user:update", existingUser.username, {
      status: "success",
      message: "auditLogsPage.messages.updateUserSuccess",
      data: {
        before: {
          ...userBefore,
          company: existingUser.companies.map((c) => c.code).join(", "),
          roles: existingUser.roles.map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem })),
        },
        after: {
          ...userAfter,
          company: updatedUser.companies.map((c) => c.code).join(", "),
          roles: updatedUser.roles.map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem })),
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...userAfter,
        companyIds: updatedUser.companies.map((c) => c.id),
        departmentIds: updatedUser.departments.map((d) => d.id),
        companyId: updatedUser.companies[0]?.id || "",
        department: updatedUser.departments[0]?.nameVi || updatedUser.departments[0]?.nameEn || "",
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
