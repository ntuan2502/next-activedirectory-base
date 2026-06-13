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
    select: {
      dn: true,
      displayName: true,
      email: true,
      createdAt: true,
      theme: true,
      locale: true,
      fontSize: true,
      fontFamily: true,
      dateFormat: true,
      timeFormat: true,
      roles: {
        select: {
          name: true,
          description: true,
        },
      },
    },
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
      isLocal: dbUser?.dn === "" || !dbUser?.dn,
      createdAt: dbUser?.createdAt ? dbUser.createdAt.toISOString() : null,
      roles: dbUser?.roles || [],
      permissions,
      theme: dbUser?.theme || "dark",
      locale: dbUser?.locale || "vi",
      fontSize: dbUser?.fontSize || 14,
      fontFamily: dbUser?.fontFamily || "sans",
      dateFormat: dbUser?.dateFormat || "YYYY-MM-DD",
      timeFormat: dbUser?.timeFormat || "24h",
    },
  });
}

export async function PATCH(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { theme, locale, fontSize, fontFamily, dateFormat, timeFormat } = body;

    const updateData: {
      theme?: string;
      locale?: string;
      fontSize?: number;
      fontFamily?: string;
      dateFormat?: string;
      timeFormat?: string;
    } = {};
    if (theme !== undefined) updateData.theme = theme;
    if (locale !== undefined) updateData.locale = locale;
    if (fontSize !== undefined) updateData.fontSize = Number(fontSize);
    if (fontFamily !== undefined) updateData.fontFamily = fontFamily;
    if (dateFormat !== undefined) updateData.dateFormat = dateFormat;
    if (timeFormat !== undefined) updateData.timeFormat = timeFormat;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      settings: {
        theme: updatedUser.theme,
        locale: updatedUser.locale,
        fontSize: updatedUser.fontSize,
        fontFamily: updatedUser.fontFamily,
        dateFormat: updatedUser.dateFormat,
        timeFormat: updatedUser.timeFormat,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
