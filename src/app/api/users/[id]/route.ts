import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { getServerTranslator } from "@/lib/i18n";
import { getUserById, updateUser, deleteUser } from "@/modules/users/services";
import { handleApiError } from "@/lib/errors";

// GET: Lấy thông tin chi tiết một người dùng
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResponse = await requirePermission(PERMISSIONS.USERS_READ);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const { id } = await params;
    const user = await getUserById(id);

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
    return handleApiError(error, t, "errors.failedToFetchUsers");
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
    await deleteUser(id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, t, "errors.failedToDeleteUser");
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

    const result = await updateUser(id, {
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
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    return handleApiError(error, t, "errors.failedToUpdateUser");
  }
}
