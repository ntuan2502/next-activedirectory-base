import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { DEFAULT_LIMIT } from "@/config/constants";
import { getServerTranslator } from "@/lib/i18n";
import { getUsersList, createUser } from "@/modules/users/services";

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

    const { users, pagination } = await getUsersList({
      page,
      limit,
      search,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({
      success: true,
      data: users,
      pagination,
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

    const formattedUser = await createUser({
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
    });

    return NextResponse.json({
      success: true,
      data: formattedUser,
    });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    if (rawMessage === "MISSING_REQUIRED_FIELDS") {
      return NextResponse.json({ error: t("errors.missingRequiredFields") }, { status: 400 });
    }
    if (rawMessage === "USER_ALREADY_EXISTS") {
      return NextResponse.json({ error: t("errors.userAlreadyExists") }, { status: 400 });
    }
    if (rawMessage.startsWith("PASSWORD_VALIDATION_FAILED:")) {
      const errorJson = rawMessage.substring("PASSWORD_VALIDATION_FAILED:".length);
      const validationErrors = JSON.parse(errorJson) as { key: string; variables?: Record<string, string | number> }[];
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

    const message = t("errors.failedToCreateUser", { error: rawMessage });
    console.error(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
