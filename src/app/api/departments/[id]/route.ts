import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { getServerTranslator } from "@/lib/i18n";
import { getDepartmentById, updateDepartment, deleteDepartment } from "@/modules/departments/services";
import { handleApiError } from "@/lib/errors";
import { UpdateDepartmentSchema } from "@/modules/departments/schemas";

// GET: Lấy thông tin chi tiết một phòng ban
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResponse = await requirePermission(PERMISSIONS.DEPARTMENTS_READ);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const { id } = await params;
    const dept = await getDepartmentById(id);

    if (!dept) {
      return NextResponse.json({ error: t("errors.departmentNotFound") }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: dept,
    });
  } catch (error: unknown) {
    return handleApiError(error, t, "errors.failedToFetchUsers");
  }
}

// PATCH: Cập nhật phòng ban
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResponse = await requirePermission(PERMISSIONS.DEPARTMENTS_UPDATE);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = UpdateDepartmentSchema.parse(body);

    const updatedDept = await updateDepartment(id, validatedData);

    return NextResponse.json({
      success: true,
      data: updatedDept,
    });
  } catch (error: unknown) {
    return handleApiError(error, t, "errors.failedToFetchUsers");
  }
}

// DELETE: Xóa phòng ban
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResponse = await requirePermission(PERMISSIONS.DEPARTMENTS_DELETE);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const { id } = await params;
    await deleteDepartment(id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, t, "errors.failedToFetchUsers");
  }
}
