import { NextResponse } from "next/server";
import { deleteSession, getSession } from "@/lib/session";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/db";

export async function POST() {
  const session = await getSession();
  if (session) {
    const dbSession = await prisma.session.findUnique({
      where: { id: session.sessionId },
    });
    await logAction("auth:logout", session.username, {
      userId: session.userId,
      sessionId: session.sessionId,
      ipAddress: dbSession?.ipAddress || null,
      userAgent: dbSession?.userAgent || null,
    });
  }
  await deleteSession();
  return NextResponse.json({ success: true });
}
