import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { sseManager } from "@/lib/sse";
import { logAction } from "@/lib/audit";
import { getServerTranslator } from "@/lib/i18n";

// GET /api/auth/sessions - Fetch all active sessions of the current user
export async function GET() {
  const session = await getSession();
  const { t } = await getServerTranslator();
  if (!session) {
    return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 });
  }

  try {
    const sessions = await prisma.session.findMany({
      where: { userId: session.userId },
      orderBy: { lastActiveAt: "desc" },
    });

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        createdAt: s.createdAt.toISOString(),
        lastActiveAt: s.lastActiveAt.toISOString(),
        isCurrent: s.id === session.sessionId,
      })),
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Unknown error";
    const message = t("errors.failedToFetchSessions", { error: rawMessage });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/auth/sessions - Revoke active sessions (specific session ID, all other sessions, or all sessions)
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  const { t } = await getServerTranslator();
  if (!session) {
    return NextResponse.json({ error: t("errors.unauthorized") }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const id = searchParams.get("id");

  try {
    const cookieStore = await cookies();

    if (action === "all") {
      // Revoke all sessions for this user (logs out current device too)
      await prisma.session.deleteMany({
        where: { userId: session.userId },
      });

      await logAction("session:revoke_all", session.username, {
        message: t("logs.sessionRevokedAll", { username: session.username })
      });

      cookieStore.delete("session");

      // Notify all devices to log out
      sseManager.publish({
        userId: session.userId,
        type: "FORCE_LOGOUT",
      });

      return NextResponse.json({ success: true, loggedOutCurrent: true });
    }

    if (action === "other") {
      // Revoke all sessions except the current one
      await prisma.session.deleteMany({
        where: {
          userId: session.userId,
          id: { not: session.sessionId },
        },
      });

      await logAction("session:revoke_other", session.username, {
        message: t("logs.sessionRevokedOther", { username: session.username })
      });

      // Notify all other sessions to log out
      sseManager.publish({
        userId: session.userId,
        type: "SESSION_REVOKED",
        payload: { exclude: session.sessionId },
      });

      return NextResponse.json({ success: true });
    }

    if (id) {
      // Revoke a specific session. First ensure it belongs to the current user
      const targetSession = await prisma.session.findFirst({
        where: {
          id: id,
          userId: session.userId,
        },
      });

      if (!targetSession) {
        return NextResponse.json({ error: t("errors.sessionNotFound") }, { status: 404 });
      }

      await prisma.session.delete({
        where: { id: id },
      });

      await logAction("session:revoke_specific", id, {
        targetSessionId: id,
        ipAddress: targetSession.ipAddress,
        userAgent: targetSession.userAgent,
        message: t("logs.sessionRevokedSpecific", { id, username: session.username })
      });

      // Notify target session to log out
      sseManager.publish({
        userId: session.userId,
        type: "SESSION_REVOKED",
        sessionId: id,
      });

      const isCurrent = id === session.sessionId;
      if (isCurrent) {
        cookieStore.delete("session");
      }

      return NextResponse.json({ success: true, loggedOutCurrent: isCurrent });
    }

    return NextResponse.json({ error: t("errors.invalidAction") }, { status: 400 });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Unknown error";
    const message = t("errors.failedToDeleteSessions", { error: rawMessage });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
