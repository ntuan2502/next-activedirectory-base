import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/audit";
import { getServerTranslator } from "@/lib/i18n";

interface UpdateCompanyBody {
  code?: string;
  nameVi?: string;
  nameEn?: string;
  taxAddress?: string;
  taxCode?: string;
}

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

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

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
    const body = (await request.json()) as UpdateCompanyBody;
    const { code, nameVi, nameEn, taxAddress, taxCode } = body;

    const existingCompany = await prisma.company.findUnique({
      where: { id },
    });

    if (!existingCompany) {
      return NextResponse.json({ error: t("errors.companyNotFound") }, { status: 404 });
    }

    const updateData: UpdateCompanyBody = {};

    if (code !== undefined) {
      const formattedCode = code.trim().toUpperCase();
      if (!formattedCode) {
        return NextResponse.json({ error: t("errors.companyCodeCannotBeEmpty") }, { status: 400 });
      }

      // Kiểm tra trùng lặp mã với công ty khác
      if (formattedCode !== existingCompany.code) {
        const codeDuplicate = await prisma.company.findUnique({
          where: { code: formattedCode },
        });
        if (codeDuplicate) {
          return NextResponse.json({ error: t("errors.companyCodeExists", { code: formattedCode }) }, { status: 400 });
        }
      }
      updateData.code = formattedCode;
    }

    if (nameVi !== undefined) updateData.nameVi = nameVi.trim();
    if (nameEn !== undefined) updateData.nameEn = nameEn.trim();
    if (taxAddress !== undefined) updateData.taxAddress = taxAddress.trim();
    if (taxCode !== undefined) updateData.taxCode = taxCode.trim();

    const updatedCompany = await prisma.company.update({
      where: { id },
      data: updateData,
    });

    // Ghi audit log
    await logAction("company:update", updatedCompany.code, {
      status: "success",
      message: "auditLogsPage.messages.updateCompanySuccess",
      data: {
        before: existingCompany,
        after: updatedCompany,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedCompany,
    });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
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

    const existingCompany = await prisma.company.findUnique({
      where: { id },
    });

    if (!existingCompany) {
      return NextResponse.json({ error: t("errors.companyNotFound") }, { status: 404 });
    }

    // Kiểm tra xem có người dùng nào liên kết với công ty không
    const userCount = await prisma.user.count({
      where: {
        companies: {
          some: { id },
        },
      },
    });

    if (userCount > 0) {
      return NextResponse.json(
        { error: t("errors.cannotDeleteCompanyHasUsers") },
        { status: 400 },
      );
    }

    // Tiến hành xóa
    await prisma.company.delete({
      where: { id },
    });

    // Ghi audit log
    await logAction("company:delete", existingCompany.code, {
      status: "success",
      message: "auditLogsPage.messages.deleteCompanySuccess",
      data: {
        before: existingCompany,
        after: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToDeleteCompany", { error: rawMessage });
    console.error(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
