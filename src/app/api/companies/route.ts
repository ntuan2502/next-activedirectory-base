import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { DEFAULT_LIMIT } from "@/config/constants";
import { getServerTranslator } from "@/lib/i18n";
import { getCompaniesList, createCompany } from "@/modules/companies/services";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

// GET: Lấy danh sách công ty (hỗ trợ phân trang, tìm kiếm, sắp xếp)
export async function GET(request: NextRequest) {
  const authResponse = await requirePermission(PERMISSIONS.COMPANIES_READ);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(10000, parseInt(searchParams.get("limit") || DEFAULT_LIMIT.toString(), 10)));
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "code";
    const sortOrder = searchParams.get("sortOrder") || "asc";

    const { companies, pagination } = await getCompaniesList({
      page,
      limit,
      search,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({
      success: true,
      data: companies,
      pagination,
    });
  } catch (error: unknown) {
    return handleApiError(error, t, "errors.failedToFetchCompanies");
  }
}

// POST: Tạo mới một công ty
export async function POST(request: NextRequest) {
  const authResponse = await requirePermission(PERMISSIONS.COMPANIES_CREATE);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const body = await request.json();
    const { code, nameVi, nameEn, taxAddress, taxCode } = body;

    if (!code || !code.trim()) {
      return NextResponse.json({ error: t("errors.companyCodeRequired") }, { status: 400 });
    }

    const newCompany = await createCompany({
      code,
      nameVi,
      nameEn,
      taxAddress,
      taxCode,
    });

    return NextResponse.json({
      success: true,
      data: newCompany,
    });
  } catch (error: unknown) {
    return handleApiError(error, t, "errors.failedToCreateCompany");
  }
}
