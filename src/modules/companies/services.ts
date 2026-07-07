import { prisma } from "@/lib/db";
import { logAction } from "@/modules/audit-logs/services";
import { CreateCompanyInput, UpdateCompanyInput } from "./types";
import { Prisma } from "@prisma/client";

export async function getCompaniesList(params: {
  page: number;
  limit: number;
  search: string;
  sortBy: string;
  sortOrder: string;
}) {
  const { page, limit, search, sortBy, sortOrder } = params;
  const offset = (page - 1) * limit;

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

  const allowedSortFields = ["code", "nameVi", "nameEn", "taxCode", "taxAddress", "createdAt"];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : "code";
  const sortDirection = sortOrder === "desc" ? "desc" : "asc";

  const orderBy: Prisma.CompanyOrderByWithRelationInput = {
    [sortField]: sortDirection,
  };

  const [total, companies] = await Promise.all([
    prisma.company.count({ where }),
    prisma.company.findMany({
      where,
      orderBy,
      skip: offset,
      take: limit,
      include: {
        _count: {
          select: { users: true, departments: true },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    companies,
    pagination: {
      page,
      limit,
      totalCount: total,
      totalPages,
    },
  };
}

export async function getCompanyById(id: string) {
  return prisma.company.findUnique({
    where: { id },
    include: {
      _count: {
        select: { users: true },
      },
    },
  });
}

export async function createCompany(input: CreateCompanyInput) {
  const { code, nameVi, nameEn, taxAddress, taxCode } = input;
  const formattedCode = code.trim().toUpperCase();

  const existing = await prisma.company.findUnique({
    where: { code: formattedCode },
  });

  if (existing) {
    throw new Error(`COMPANY_CODE_EXISTS:${formattedCode}`);
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

  await logAction("company:create", formattedCode, {
    status: "success",
    message: "auditLogsPage.messages.createCompanySuccess",
    data: {
      before: null,
      after: newCompany,
    },
  });

  return newCompany;
}

export async function updateCompany(id: string, input: UpdateCompanyInput) {
  const { code, nameVi, nameEn, taxAddress, taxCode } = input;

  const existingCompany = await prisma.company.findUnique({
    where: { id },
  });

  if (!existingCompany) {
    throw new Error("COMPANY_NOT_FOUND");
  }

  const updateData: Prisma.CompanyUpdateInput = {};

  if (code !== undefined) {
    const formattedCode = code.trim().toUpperCase();
    if (!formattedCode) {
      throw new Error("COMPANY_CODE_CANNOT_BE_EMPTY");
    }

    if (formattedCode !== existingCompany.code) {
      const codeDuplicate = await prisma.company.findUnique({
        where: { code: formattedCode },
      });
      if (codeDuplicate) {
        throw new Error(`COMPANY_CODE_EXISTS:${formattedCode}`);
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

  await logAction("company:update", updatedCompany.code, {
    status: "success",
    message: "auditLogsPage.messages.updateCompanySuccess",
    data: {
      before: existingCompany,
      after: updatedCompany,
    },
  });

  return updatedCompany;
}

export async function deleteCompany(id: string) {
  const existingCompany = await prisma.company.findUnique({
    where: { id },
  });

  if (!existingCompany) {
    throw new Error("COMPANY_NOT_FOUND");
  }

  const userCount = await prisma.user.count({
    where: {
      companies: {
        some: { id },
      },
    },
  });

  if (userCount > 0) {
    throw new Error("CANNOT_DELETE_COMPANY_HAS_USERS");
  }

  await prisma.company.delete({
    where: { id },
  });

  await logAction("company:delete", existingCompany.code, {
    status: "success",
    message: "auditLogsPage.messages.deleteCompanySuccess",
    data: {
      before: existingCompany,
      after: null,
    },
  });

  return true;
}
