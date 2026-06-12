import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

// GET /api/auth/sessions - Fetch all active sessions of the current user
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const message = error instanceof Error ? error.message : "Failed to fetch sessions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/auth/sessions - Revoke active sessions (specific session ID, all other sessions, or all sessions)
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

      cookieStore.delete("session");

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
        return NextResponse.json({ error: "Session not found or unauthorized" }, { status: 404 });
      }

      await prisma.session.delete({
        where: { id: id },
      });

      const isCurrent = id === session.sessionId;
      if (isCurrent) {
        cookieStore.delete("session");
      }

      return NextResponse.json({ success: true, loggedOutCurrent: isCurrent });
    }

    return NextResponse.json({ error: "Invalid action or parameters" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete sessions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
