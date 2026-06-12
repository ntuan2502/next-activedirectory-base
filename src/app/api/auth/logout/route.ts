import { NextResponse } from "next/server";
import { deleteSession, getSession } from "@/lib/session";
import { logAction } from "@/lib/audit";

export async function POST() {
  const session = await getSession();
  if (session) {
    await logAction("auth:logout", session.username);
  }
  await deleteSession();
  return NextResponse.json({ success: true });
}
