import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { getServerTranslator } from "@/lib/i18n";
import { getCompanyById, updateCompany, deleteCompany } from "@/modules/companies/services";
import { handleApiError } from "@/lib/errors";
import { UpdateCompanySchema } from "@/modules/companies/schemas";

// GET: Lấy thông tin chi tiết một công ty
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResponse = await requirePermission(PERMISSIONS.COMPANIES_READ);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const { id } = await params;
    const company = await getCompanyById(id);

    if (!company) {
      return NextResponse.json({ error: t("errors.companyNotFound") }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: company,
    });
  } catch (error: unknown) {
    return handleApiError(error, t, "errors.failedToFetchCompanies");
  }
}

// PATCH: Cập nhật thông tin công ty
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResponse = await requirePermission(PERMISSIONS.COMPANIES_UPDATE);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = UpdateCompanySchema.parse(body);

    const updatedCompany = await updateCompany(id, validatedData);

    return NextResponse.json({
      success: true,
      data: updatedCompany,
    });
  } catch (error: unknown) {
    return handleApiError(error, t, "errors.failedToUpdateCompany");
  }
}

// DELETE: Xóa công ty (chỉ cho xóa nếu không có người dùng nào thuộc công ty)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResponse = await requirePermission(PERMISSIONS.COMPANIES_DELETE);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const { id } = await params;
    await deleteCompany(id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, t, "errors.failedToDeleteCompany");
  }
}
