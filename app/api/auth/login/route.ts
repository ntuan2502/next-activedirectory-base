import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth";
import { createSession } from "@/lib/session";

type LoginBody = {
  username: string;
  password: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LoginBody;
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 },
      );
    }

    const result = await authenticateUser(username, password);

    await createSession({
      userId: result.userId,
      username: result.username,
    });

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
    return NextResponse.json(
      { error: message },
      { status: 401 },
    );
  }
}
