import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserPermissions } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import crypto from "crypto";
import { sseManager } from "@/lib/sse";
import { getServerTranslator } from "@/lib/i18n";
import { logAction } from "@/lib/audit";

export async function GET() {
  const session = await getSession();
  const { t } = await getServerTranslator();

  if (!session) {
    return NextResponse.json(
      { error: t("errors.notAuthenticated") },
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

  if (!dbUser) {
    return NextResponse.json(
      { error: t("errors.userNotFound") },
      { status: 401 },
    );
  }

  const email = dbUser.email;
  const displayName = dbUser.displayName || session.username;

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
      isLocal: dbUser.dn === "",
      createdAt: dbUser.createdAt.toISOString(),
      roles: dbUser.roles,
      permissions,
      theme: dbUser.theme,
      locale: dbUser.locale,
      fontSize: dbUser.fontSize,
      fontFamily: dbUser.fontFamily,
      dateFormat: dbUser.dateFormat,
      timeFormat: dbUser.timeFormat,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  const { t } = await getServerTranslator();

  if (!session) {
    return NextResponse.json(
      { error: t("errors.notAuthenticated") },
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
      return NextResponse.json({ error: t("errors.noFieldsToUpdate") }, { status: 400 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: t("errors.userNotFound") },
        { status: 404 },
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: updateData,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _1, ...beforeWithoutPassword } = currentUser;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _2, ...afterWithoutPassword } = updatedUser;

    await logAction(
      "user:update_settings",
      currentUser.username,
      {
        status: "success",
        message: "auditLogsPage.messages.updateSettingsSuccess",
        data: {
          before: beforeWithoutPassword,
          after: afterWithoutPassword,
        },
      },
      {
        userId: session.userId,
        username: currentUser.username,
      }
    );

    sseManager.publish({
      userId: session.userId,
      sessionId: session.sessionId,
      type: "SETTINGS_UPDATED",
      payload: {
        theme: updatedUser.theme,
        locale: updatedUser.locale,
        fontSize: updatedUser.fontSize,
        fontFamily: updatedUser.fontFamily,
        dateFormat: updatedUser.dateFormat,
        timeFormat: updatedUser.timeFormat,
      },
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
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToUpdateSettings", { error: rawMessage });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
