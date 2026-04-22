import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function getUserPermissions(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: true },
  });

  if (!user || user.disabled) {
    return [];
  }

  // If any of the roles is the system Super Admin role, they have all permissions
  // To represent "all permissions", we can either return a special token like "*"
  // or just handle it dynamically. Let's return ["*"]
  const isSuperAdmin = user.roles.some((role) => role.isSystem);
  if (isSuperAdmin) {
    return ["*"];
  }

  // Merge all permissions from all roles
  const permissionsSet = new Set<string>();
  for (const role of user.roles) {
    try {
      const perms: string[] = JSON.parse(role.permissions);
      perms.forEach((p) => permissionsSet.add(p));
    } catch {
      // Ignore parse errors for a single role
    }
  }

  return Array.from(permissionsSet);
}

export async function hasPermission(permission: string): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;

  const userPermissions = await getUserPermissions(session.userId);
  if (userPermissions.includes("*")) {
    return true; // Super Admin bypass
  }

  return userPermissions.includes(permission);
}

export async function requirePermission(permission: string): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAllowed = await hasPermission(permission);
  if (!isAllowed) {
    return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
  }

  // Return null if allowed
  return null;
}
