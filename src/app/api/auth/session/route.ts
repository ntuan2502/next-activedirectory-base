import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserPermissions } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import crypto from "crypto";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 },
    );
  }

  const permissions = await getUserPermissions(session.userId);

  const dbUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { displayName: true, email: true },
  });

  const email = dbUser?.email || "";
  const displayName = dbUser?.displayName || session.username;

  // Compute Gravatar URL with md5 hash
  let avatarUrl = "";
  if (email) {
    const hash = crypto.createHash("md5").update(email.trim().toLowerCase()).digest("hex");
    avatarUrl = `https://www.gravatar.com/avatar/${hash}?d=404`;
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      ...session,
      displayName,
      email,
      avatarUrl,
      permissions,
    },
  });
}
