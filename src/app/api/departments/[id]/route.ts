import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { getServerTranslator } from "@/lib/i18n";
import { getDepartmentById, updateDepartment, deleteDepartment } from "@/modules/departments/services";

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
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    return NextResponse.json({ error: rawMessage }, { status: 500 });
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
    const { code, nameVi, nameEn, companyId, parentId, managerId, subDepartmentIds, userIds } = body;

    const updatedDept = await updateDepartment(id, {
      code,
      nameVi,
      nameEn,
      companyId,
      parentId,
      managerId,
      subDepartmentIds,
      userIds,
    });

    return NextResponse.json({
      success: true,
      data: updatedDept,
    });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    if (rawMessage === "DEPARTMENT_NOT_FOUND") {
      return NextResponse.json({ error: t("errors.departmentNotFound") }, { status: 404 });
    }
    if (rawMessage === "INVALID_PAYLOAD") {
      return NextResponse.json({ error: t("errors.invalidPayload") }, { status: 400 });
    }
    if (rawMessage === "DEPARTMENT_CODE_EXISTS") {
      return NextResponse.json({ error: t("errors.departmentCodeExists") }, { status: 400 });
    }
    if (rawMessage === "PARENT_DEPARTMENT_MUST_BELONG_TO_COMPANY") {
      return NextResponse.json({ error: t("errors.parentDepartmentMustBelongToCompany") }, { status: 400 });
    }
    if (rawMessage === "MANAGER_MUST_BELONG_TO_DEPARTMENT") {
      return NextResponse.json({ error: t("errors.managerMustBelongToDepartment") }, { status: 400 });
    }
    if (rawMessage === "CANNOT_CHANGE_COMPANY_WITH_SUB_DEPARTMENTS") {
      return NextResponse.json({ error: t("errors.cannotChangeCompanyWithSubDepartments") }, { status: 400 });
    }
    if (rawMessage === "CANNOT_ADD_SUB_DEPARTMENT_DIFFERENT_COMPANY") {
      return NextResponse.json({ error: t("errors.cannotAddSubDepartmentDifferentCompany") }, { status: 400 });
    }

    return NextResponse.json({ error: rawMessage }, { status: 500 });
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
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    if (rawMessage === "DEPARTMENT_NOT_FOUND") {
      return NextResponse.json({ error: t("errors.departmentNotFound") }, { status: 404 });
    }
    if (rawMessage === "CANNOT_DELETE_DEPARTMENT_HAS_USERS") {
      return NextResponse.json(
        { error: t("errors.cannotDeleteDepartmentHasUsers") },
        { status: 400 },
      );
    }
    if (rawMessage === "CANNOT_DELETE_DEPARTMENT_HAS_SUB_DEPARTMENTS") {
      return NextResponse.json(
        { error: t("errors.cannotDeleteDepartmentHasSubDepartments") },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: rawMessage }, { status: 500 });
  }
}
