import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { Prisma } from "@prisma/client";
import { DEFAULT_LIMIT } from "@/config/constants";
import { logAction } from "@/lib/audit";
import { getServerTranslator } from "@/lib/i18n";

export const dynamic = "force-dynamic";

// GET: Lấy danh sách công ty (hỗ trợ phân trang, tìm kiếm, sắp xếp)
export async function GET(request: NextRequest) {
  const authResponse = await requirePermission(PERMISSIONS.COMPANIES_READ);
  if (authResponse) return authResponse;

  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || DEFAULT_LIMIT.toString(), 10)));
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "code";
    const sortOrder = searchParams.get("sortOrder") || "asc";

    const offset = (page - 1) * limit;

    // Bộ lọc tìm kiếm
    const where: Prisma.CompanyWhereInput = {};

    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { nameVi: { contains: search, mode: "insensitive" } },
        { nameEn: { contains: search, mode: "insensitive" } },
        { taxCode: { contains: search, mode: "insensitive" } },
        { taxAddress: { contains: search, mode: "insensitive" } },
      ];
    }

    // Bộ lọc sắp xếp
    const allowedSortFields = ["code", "nameVi", "nameEn", "taxCode", "taxAddress", "createdAt"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "code";
    const sortDirection = sortOrder === "desc" ? "desc" : "asc";

    const orderBy: Prisma.CompanyOrderByWithRelationInput = {
      [sortField]: sortDirection,
    };

    // Thực hiện truy vấn
    const [total, companies] = await Promise.all([
      prisma.company.count({ where }),
      prisma.company.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include: {
          _count: {
            select: { users: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: companies,
      pagination: {
        page,
        limit,
        totalCount: total,
        totalPages,
      },
    });
  } catch (error: unknown) {
    const { t } = await getServerTranslator();
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToFetchCompanies", { error: rawMessage });
    console.error(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface CreateCompanyBody {
  code: string;
  nameVi?: string;
  nameEn?: string;
  taxAddress?: string;
  taxCode?: string;
}

// POST: Tạo mới một công ty
export async function POST(request: NextRequest) {
  const authResponse = await requirePermission(PERMISSIONS.COMPANIES_CREATE);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const body = (await request.json()) as CreateCompanyBody;
    const { code, nameVi, nameEn, taxAddress, taxCode } = body;

    if (!code || !code.trim()) {
      return NextResponse.json({ error: t("errors.companyCodeRequired") }, { status: 400 });
    }

    const formattedCode = code.trim().toUpperCase();

    // Kiểm tra xem mã công ty đã tồn tại chưa
    const existing = await prisma.company.findUnique({
      where: { code: formattedCode },
    });

    if (existing) {
      return NextResponse.json({ error: t("errors.companyCodeExists", { code: formattedCode }) }, { status: 400 });
    }

    const newCompany = await prisma.company.create({
      data: {
        code: formattedCode,
        nameVi: (nameVi || "").trim(),
        nameEn: (nameEn || "").trim(),
        taxAddress: (taxAddress || "").trim(),
        taxCode: (taxCode || "").trim(),
      },
    });

    // Ghi audit log
    await logAction("company:create", formattedCode, {
      status: "success",
      message: "auditLogsPage.messages.createCompanySuccess",
      data: {
        before: null,
        after: newCompany,
      },
    });

    return NextResponse.json({
      success: true,
      data: newCompany,
    });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToCreateCompany", { error: rawMessage });
    console.error(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
