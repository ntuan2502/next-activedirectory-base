import { NextRequest, NextResponse } from "next/server";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { DEFAULT_LIMIT } from "@/config/constants";
import { getServerTranslator } from "@/lib/i18n";
import { getRolesList, createRole } from "@/modules/roles/services";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authResponse = await requirePermission(PERMISSIONS.ROLES_READ);
  if (authResponse) return authResponse;

  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(10000, parseInt(searchParams.get("limit") || DEFAULT_LIMIT.toString(), 10)));
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "all";
    const sortBy = searchParams.get("sortBy") || "name";
    const sortOrder = searchParams.get("sortOrder") || "asc";

    const { roles, pagination } = await getRolesList({
      page,
      limit,
      search,
      type,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({
      success: true,
      data: roles,
      pagination,
    });
  } catch (error: unknown) {
    const { t } = await getServerTranslator();
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToFetchRoles", { error: rawMessage });
    console.error(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResponse = await requirePermission(PERMISSIONS.ROLES_CREATE);
  if (authResponse) return authResponse;

  const { t } = await getServerTranslator();

  try {
    const body = await request.json();
    const { name, description, permissions } = body;

    const role = await createRole({ name, description, permissions });

    return NextResponse.json({ success: true, data: role });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    if (rawMessage === "ROLE_NAME_REQUIRED") {
      return NextResponse.json({ error: t("rolesPage.roleNameRequired") }, { status: 400 });
    }
    if (rawMessage === "ROLE_NAME_EXISTS") {
      return NextResponse.json({ error: t("errors.roleNameExists") }, { status: 400 });
    }

    const message = t("errors.failedToCreateRole", { error: rawMessage });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
