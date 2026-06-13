import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userCount = await prisma.user.count();
    return NextResponse.json({
      success: true,
      isSetup: userCount > 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to query setup status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
