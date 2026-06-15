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
      before: dbSession || {
        id: session.sessionId,
        userId: session.userId,
      },
      after: null,
    });
  }
  await deleteSession();
  return NextResponse.json({ success: true });
}
