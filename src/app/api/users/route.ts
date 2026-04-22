import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { username: "asc" },
      select: {
        id: true,
        username: true,
        displayName: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        title: true,
        department: true,
        disabled: true,
      },
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch users.";
    console.error("Users API Error:", error);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
