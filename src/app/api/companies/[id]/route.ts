import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { getServerTranslator } from "@/lib/i18n";
import { getCompanyById, updateCompany, deleteCompany } from "@/modules/companies/services";

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
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    return NextResponse.json(
      { error: t("errors.failedToFetchCompanies", { error: rawMessage }) },
      { status: 500 }
    );
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
    const { code, nameVi, nameEn, taxAddress, taxCode } = body;

    const updatedCompany = await updateCompany(id, {
      code,
      nameVi,
      nameEn,
      taxAddress,
      taxCode,
    });

    return NextResponse.json({
      success: true,
      data: updatedCompany,
    });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    if (rawMessage === "COMPANY_NOT_FOUND") {
      return NextResponse.json({ error: t("errors.companyNotFound") }, { status: 404 });
    }
    if (rawMessage === "COMPANY_CODE_CANNOT_BE_EMPTY") {
      return NextResponse.json({ error: t("errors.companyCodeCannotBeEmpty") }, { status: 400 });
    }
    if (rawMessage.startsWith("COMPANY_CODE_EXISTS:")) {
      const code = rawMessage.split(":")[1];
      return NextResponse.json({ error: t("errors.companyCodeExists", { code }) }, { status: 400 });
    }

    const message = t("errors.failedToUpdateCompany", { error: rawMessage });
    console.error(error);
    return NextResponse.json({ error: message }, { status: 500 });
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
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    if (rawMessage === "COMPANY_NOT_FOUND") {
      return NextResponse.json({ error: t("errors.companyNotFound") }, { status: 404 });
    }
    if (rawMessage === "CANNOT_DELETE_COMPANY_HAS_USERS") {
      return NextResponse.json(
        { error: t("errors.cannotDeleteCompanyHasUsers") },
        { status: 400 },
      );
    }

    const message = t("errors.failedToDeleteCompany", { error: rawMessage });
    console.error(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
