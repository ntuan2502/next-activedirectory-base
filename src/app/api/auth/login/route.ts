import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, AuthError } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { logAction } from "@/modules/audit-logs/services";
import { getServerTranslator } from "@/lib/i18n";
import { headers } from "next/headers";

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
      status: "success",
      message: "auditLogsPage.messages.loginSuccess",
      data: {
        before: null,
        after: dbSession,
      },
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
    let errorKey = "errors.authenticationFailed";
    if (error instanceof AuthError) {
      errorKey = error.message;
    } else if (error instanceof Error) {
      errorKey = error.message;
    }

    const clientMessage = errorKey.includes(".") && !errorKey.includes(" ") ? t(errorKey) : errorKey;

    if (requestUsername) {
      const headersList = await headers();
      const userAgent = headersList.get("user-agent") || null;
      const ipAddress = headersList.get("x-forwarded-for")?.split(",")[0] || headersList.get("x-real-ip") || null;

      await logAction("auth:login", requestUsername, {
        status: "failed",
        message: errorKey,
        data: {
          before: null,
          after: {
            id: null,
            userId: null,
            ipAddress,
            userAgent,
            createdAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
          },
        },
      });
    }
    return NextResponse.json(
      { error: clientMessage },
      { status: 401 },
    );
  }
}
