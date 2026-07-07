import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { Prisma } from "@prisma/client";
import { DEFAULT_LIMIT } from "@/config/constants";
import { logAction } from "@/lib/audit";
import { getServerTranslator } from "@/lib/i18n";

export const dynamic = "force-dynamic";

// GET: Lấy danh sách phòng ban
export async function GET(request: NextRequest) {
  const authResponse = await requirePermission(PERMISSIONS.DEPARTMENTS_READ);
  if (authResponse) return authResponse;

  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(10000, parseInt(searchParams.get("limit") || DEFAULT_LIMIT.toString(), 10)));
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "code";
    const sortOrder = searchParams.get("sortOrder") || "asc";
    const companyId = searchParams.get("companyId") || "";

    const offset = (page - 1) * limit;

    // Bộ lọc
    const where: Prisma.DepartmentWhereInput = {};

    if (companyId) {
      where.companyId = companyId;
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { nameVi: { contains: search, mode: "insensitive" } },
        { nameEn: { contains: search, mode: "insensitive" } },
      ];
    }

    // Sắp xếp
    const allowedSortFields = ["code", "nameVi", "nameEn", "createdAt"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "code";
    const sortDirection = sortOrder === "desc" ? "desc" : "asc";

    const orderBy: Prisma.DepartmentOrderByWithRelationInput = {
      [sortField]: sortDirection,
    };

    // Thực hiện truy vấn
    const [total, departments] = await Promise.all([
      prisma.department.count({ where }),
      prisma.department.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include: {
          companyObj: {
            select: {
              id: true,
              code: true,
              nameVi: true,
              nameEn: true,
            },
          },
          parentObj: {
            select: {
              id: true,
              code: true,
              nameVi: true,
              nameEn: true,
            },
          },
          managerObj: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
          _count: {
            select: { users: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: departments,
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
    // Dùng khóa thông báo lỗi phù hợp
    return NextResponse.json({ error: rawMessage }, { status: 500 });
  }
}

interface CreateDepartmentBody {
  code: string;
  nameVi: string;
  nameEn: string;
  companyId: string | null;
  parentId?: string | null;
  managerId?: string | null;
  subDepartmentIds?: string[];
  userIds?: string[];
}

interface FormattedDepartmentLog {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string;
  company: string;
  parentDepartment: string;
  manager: string;
  subDepartments: string;
  users: string;
}

interface DepartmentWithRelations {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string;
  companyObj?: { code: string; nameVi: string } | null;
  parentObj?: { code: string; nameVi: string } | null;
  managerObj?: { displayName: string | null; username: string } | null;
  subDepartments?: { code: string; nameVi: string }[] | null;
  users?: { id: string; username: string; displayName: string }[] | null;
}

function formatDepartmentForLog(dept: DepartmentWithRelations): FormattedDepartmentLog {
  return {
    id: dept.id,
    code: dept.code,
    nameVi: dept.nameVi,
    nameEn: dept.nameEn,
    company: dept.companyObj ? `${dept.companyObj.code} - ${dept.companyObj.nameVi}` : "GLOBAL",
    parentDepartment: dept.parentObj ? `${dept.parentObj.code} - ${dept.parentObj.nameVi}` : "None",
    manager: dept.managerObj ? `${dept.managerObj.displayName || dept.managerObj.username} (${dept.managerObj.username})` : "None",
    subDepartments: dept.subDepartments && dept.subDepartments.length > 0
      ? dept.subDepartments.map((d) => `${d.code} - ${d.nameVi}`).join(", ")
      : "None",
    users: dept.users && dept.users.length > 0
      ? dept.users.map((u) => `${u.displayName || u.username} (${u.username})`).join(", ")
      : "None",
  };
}

// POST: Tạo mới một phòng ban
export async function POST(request: NextRequest) {
  const authResponse = await requirePermission(PERMISSIONS.DEPARTMENTS_CREATE);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const body = (await request.json()) as CreateDepartmentBody;
    const { code, nameVi, nameEn, companyId, parentId, managerId, userIds } = body;

    if (!code || !code.trim()) {
      return NextResponse.json({ error: t("errors.invalidPayload") }, { status: 400 });
    }

    const companyIdVal = companyId || null;

    // Kiểm tra chéo Phòng ban cha cùng công ty
    if (parentId) {
      const parentDept = await prisma.department.findUnique({
        where: { id: parentId },
      });
      if (!parentDept || (parentDept.companyId !== null && parentDept.companyId !== companyIdVal)) {
        return NextResponse.json({ error: t("errors.parentDepartmentMustBelongToCompany") }, { status: 400 });
      }
    }

    // Không cho phép gán Trưởng phòng khi tạo mới (vì chưa có nhân viên nào thuộc phòng ban mới này)
    if (managerId) {
      return NextResponse.json({ error: t("errors.managerMustBelongToDepartment") }, { status: 400 });
    }

    const formattedCode = code.trim();

    // Kiểm tra xem mã phòng ban đã tồn tại chưa (duy nhất trên toàn hệ thống)
    const existing = await prisma.department.findFirst({
      where: {
        code: {
          equals: formattedCode,
          mode: "insensitive",
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: t("errors.departmentCodeExists") }, { status: 400 });
    }

    // Tạo phòng ban mới
    const newDept = await prisma.department.create({
      data: {
        code: formattedCode,
        nameVi: (nameVi || "").trim(),
        nameEn: (nameEn || "").trim(),
        companyId: companyIdVal,
        parentId: parentId || null,
        managerId: managerId || null,
        users: userIds && userIds.length > 0 ? {
          connect: userIds.map(id => ({ id })),
        } : undefined,
      },
      include: {
        companyObj: true,
      },
    });

    // Đồng bộ công ty cho nhân viên khi tạo mới
    if (userIds && userIds.length > 0 && companyIdVal) {
      for (const uId of userIds) {
        const hasCompany = await prisma.user.findFirst({
          where: {
            id: uId,
            companies: { some: { id: companyIdVal } },
          },
        });
        if (!hasCompany) {
          await prisma.user.update({
            where: { id: uId },
            data: {
              companies: { connect: { id: companyIdVal } },
            },
          });
        }
      }
    }

    // Xử lý gán các phòng ban con
    if (body.subDepartmentIds && body.subDepartmentIds.length > 0) {
      // Chặn nếu gán con thuộc công ty khác
      if (companyIdVal !== null) {
        const diffCompanySubDept = await prisma.department.findFirst({
          where: {
            id: { in: body.subDepartmentIds },
            companyId: { not: companyIdVal },
          },
        });
        if (diffCompanySubDept) {
          return NextResponse.json({ error: t("errors.cannotAddSubDepartmentDifferentCompany") }, { status: 400 });
        }
      }

      // Cập nhật parentId cho các con trực tiếp
      await prisma.department.updateMany({
        where: { id: { in: body.subDepartmentIds } },
        data: { parentId: newDept.id },
      });
    }

    // Fetch full department details for rich log comparison
    const fullDept = await prisma.department.findUnique({
      where: { id: newDept.id },
      include: {
        companyObj: true,
        parentObj: true,
        managerObj: true,
        subDepartments: true,
        users: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    // Ghi audit log
    const targetInfo = `${newDept.companyObj?.code || "GLOBAL"} / ${newDept.code}`;
    await logAction("department:create", targetInfo, {
      status: "success",
      message: "auditLogsPage.messages.createDepartmentSuccess",
      data: {
        before: null,
        after: fullDept ? formatDepartmentForLog(fullDept) : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: newDept,
    });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    return NextResponse.json({ error: rawMessage }, { status: 500 });
  }
}
