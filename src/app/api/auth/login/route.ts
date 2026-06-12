import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { logAction } from "@/lib/audit";

type LoginBody = {
  username: string;
  password: string;
};

export async function POST(request: NextRequest) {
  let requestUsername = "";
  try {
    const body = (await request.json()) as LoginBody;
    const { username, password } = body;
    requestUsername = username || "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 },
      );
    }

    if (username.includes("@")) {
      return NextResponse.json(
        { error: "Please use your username only, not email address." },
        { status: 400 },
      );
    }

    const result = await authenticateUser(username, password);

    await createSession({
      userId: result.userId,
      username: result.username,
    });

    await logAction("auth:login", result.username, { userId: result.userId }, { userId: result.userId, username: result.username });

    return NextResponse.json({
      success: true,
      user: {
        userId: result.userId,
        username: result.username,
        displayName: result.displayName,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Authentication failed.";
    if (requestUsername) {
      await logAction("auth:login_failed", requestUsername, { error: message });
    }
    return NextResponse.json(
      { error: message },
      { status: 401 },
    );
  }
}
