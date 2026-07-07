import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { Prisma } from "@prisma/client";
import { DEFAULT_LIMIT } from "@/config/constants";
import { getServerTranslator } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authResponse = await requirePermission(PERMISSIONS.USERS_READ);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();
  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(10000, parseInt(searchParams.get("limit") || DEFAULT_LIMIT.toString(), 10)));
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "username";
    const sortOrder = searchParams.get("sortOrder") || "asc";

    const offset = (page - 1) * limit;

    // Build filter conditions
    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: "insensitive" } },
        { displayName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        {
          departments: {
            some: {
              OR: [
                { nameVi: { contains: search, mode: "insensitive" } },
                { nameEn: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
              ]
            }
          }
        },
        {
          companies: {
            some: {
              OR: [
                { nameVi: { contains: search, mode: "insensitive" } },
                { nameEn: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
      ];
    }

    // Determine sorting
    const allowedSortFields = ["username", "displayName", "email", "title", "disabled"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "username";
    const sortDirection = sortOrder === "desc" ? "desc" : "asc";

    const orderBy: Prisma.UserOrderByWithRelationInput = { [sortField]: sortDirection };

    // Execute parallel queries for count and data
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        select: {
          id: true,
          dn: true,
          username: true,
          displayName: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          title: true,
          companies: {
            select: {
              id: true,
              code: true,
              nameVi: true,
              nameEn: true,
            }
          },
          departments: {
            select: {
              id: true,
              code: true,
              nameVi: true,
              nameEn: true,
            }
          },
          disabled: true,
          roles: {
            select: {
              id: true,
              name: true,
              isSystem: true,
            },
          },
        },
      }),
    ]);

    const formattedUsers = users.map((user) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { companies, departments, ...rest } = user;
      return {
        ...rest,
        company: user.companies.map((c) => c.code).join(", "),
        companyIds: user.companies.map((c) => c.id),
        department: user.departments.map((d) => d.nameVi || d.nameEn).join(", "),
        departmentIds: user.departments.map((d) => d.id),
      };
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: formattedUsers,
      pagination: {
        page,
        limit,
        totalCount: total,
        totalPages,
      },
    });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToFetchUsers", { error: rawMessage });
    console.error(error);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}

import bcrypt from "bcryptjs";
import { logAction } from "@/lib/audit";
import { validatePassword } from "@/lib/password-validation";

export async function POST(request: NextRequest) {
  const authResponse = await requirePermission(PERMISSIONS.USERS_CREATE);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const body = await request.json();
    const {
      username,
      displayName,
      firstName,
      lastName,
      email,
      phone,
      title,
      companyId,
      companyIds,
      departmentIds,
      password,
      roleIds,
    } = body;

    // Validation
    if (!username || !displayName || !email || !password) {
      return NextResponse.json({ error: t("errors.missingRequiredFields") }, { status: 400 });
    }

    const lowercaseUsername = username.toLowerCase();

    // Check unique username
    const existingUser = await prisma.user.findUnique({
      where: { username: lowercaseUsername },
    });

    if (existingUser) {
      return NextResponse.json({ error: t("errors.userAlreadyExists") }, { status: 400 });
    }

    // Password validation based on security settings
    const settings = await prisma.systemSetting.findFirst();
    if (settings) {
      const validationErrors = validatePassword(
        password,
        {
          passwordMinLength: settings.passwordMinLength,
          passwordPreventCommon: settings.passwordPreventCommon,
          passwordNoUserInfo: settings.passwordNoUserInfo,
          passwordRequireLetter: settings.passwordRequireLetter,
          passwordRequireNumber: settings.passwordRequireNumber,
          passwordRequireSymbol: settings.passwordRequireSymbol,
          passwordRequireMixedCase: settings.passwordRequireMixedCase,
        },
        {
          username: lowercaseUsername,
          email,
          firstName,
          lastName,
        }
      );

      if (validationErrors.length > 0) {
        return NextResponse.json(
          {
            error: t(validationErrors[0].key, validationErrors[0].variables),
            validationErrors: validationErrors.map((err) => ({
              message: t(err.key, err.variables) || err.key,
              key: err.key,
            })),
          },
          { status: 400 }
        );
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Save to Database
    const finalCompanyIds: string[] = companyIds && Array.isArray(companyIds)
      ? companyIds
      : (companyId ? [companyId] : []);

    const finalDepartmentIds: string[] = departmentIds && Array.isArray(departmentIds)
      ? departmentIds
      : [];

    const newUser = await prisma.user.create({
      data: {
        username: lowercaseUsername,
        displayName,
        firstName: firstName || "",
        lastName: lastName || "",
        email,
        phone: phone || "",
        title: title || "",
        companies: finalCompanyIds.length > 0 ? {
          connect: finalCompanyIds.map((id) => ({ id }))
        } : undefined,
        departments: finalDepartmentIds.length > 0 ? {
          connect: finalDepartmentIds.map((id) => ({ id }))
        } : undefined,
        passwordHash,
        dn: "", // Local user
        disabled: false,
        roles: roleIds && Array.isArray(roleIds) ? {
          connect: roleIds.map((id: string) => ({ id })),
        } : undefined,
      },
      include: {
        companies: true,
        departments: true,
        roles: true,
      },
    });

    // Write audit log
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...userWithoutPassword } = newUser;
    const firstCompany = newUser.companies[0]?.code || "";
    const firstDept = newUser.departments.map(d => d.nameVi || d.nameEn).join(", ") || "";
    
    await logAction("user:create", lowercaseUsername, {
      status: "success",
      message: "auditLogsPage.messages.createUserSuccess",
      data: {
        before: null,
        after: {
          ...userWithoutPassword,
          company: firstCompany,
          department: firstDept,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...userWithoutPassword,
        company: firstCompany,
        department: firstDept,
      },
    });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToCreateUser", { error: rawMessage });
    console.error(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

