import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { logAction } from "@/lib/audit";
import { getServerTranslator } from "@/lib/i18n";

type LoginBody = {
  username: string;
  password: string;
};

export async function POST(request: NextRequest) {
  let requestUsername = "";
  const { t } = await getServerTranslator();
  try {
    const body = (await request.json()) as LoginBody;
    const { username, password } = body;
    requestUsername = username || "";

    if (!username || !password) {
      return NextResponse.json(
        { error: t("errors.usernamePasswordRequired") },
        { status: 400 },
      );
    }

    if (username.includes("@")) {
      return NextResponse.json(
        { error: t("errors.useUsernameOnly") },
        { status: 400 },
      );
    }

    const result = await authenticateUser(username, password);

    const dbSession = await createSession({
      userId: result.userId,
      username: result.username,
    });

    await logAction("auth:login", result.username, {
      before: null,
      after: dbSession,
    }, {
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
    const message = error instanceof Error ? error.message : t("errors.authenticationFailed");
    if (requestUsername) {
      await logAction("auth:login_failed", requestUsername, {
        before: null,
        after: { error: message },
      });
    }
    return NextResponse.json(
      { error: message },
      { status: 401 },
    );
  }
}
