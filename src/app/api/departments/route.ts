import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { DEFAULT_LIMIT } from "@/config/constants";
import { getServerTranslator } from "@/lib/i18n";
import { getDepartmentsList, createDepartment } from "@/modules/departments/services";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

// GET: Lấy danh sách phòng ban
export async function GET(request: NextRequest) {
  const authResponse = await requirePermission(PERMISSIONS.DEPARTMENTS_READ);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(10000, parseInt(searchParams.get("limit") || DEFAULT_LIMIT.toString(), 10)));
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "code";
    const sortOrder = searchParams.get("sortOrder") || "asc";
    const companyId = searchParams.get("companyId") || "";

    const { departments, pagination } = await getDepartmentsList({
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      companyId,
    });

    return NextResponse.json({
      success: true,
      data: departments,
      pagination,
    });
  } catch (error: unknown) {
    return handleApiError(error, t, "errors.failedToFetchUsers"); // Using shared error string or generic one
  }
}

// POST: Tạo mới một phòng ban
export async function POST(request: NextRequest) {
  const authResponse = await requirePermission(PERMISSIONS.DEPARTMENTS_CREATE);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const body = await request.json();
    const { code, nameVi, nameEn, companyId, parentId, managerId, subDepartmentIds, userIds } = body;

    if (!code || !code.trim()) {
      return NextResponse.json({ error: t("errors.invalidPayload") }, { status: 400 });
    }

    const newDept = await createDepartment({
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
      data: newDept,
    });
  } catch (error: unknown) {
    return handleApiError(error, t, "errors.failedToFetchUsers");
  }
}
