import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserPermissions } from "@/lib/permissions";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 },
    );
  }

  const permissions = await getUserPermissions(session.userId);

  return NextResponse.json({
    authenticated: true,
    user: {
      ...session,
      permissions,
    },
  });
}
