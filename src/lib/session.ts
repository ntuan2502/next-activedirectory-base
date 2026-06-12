import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

export type SessionPayload = {
  userId: string;
  username: string;
  sessionId: string;
};

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(payload: Omit<SessionPayload, "sessionId">): Promise<void> {
  const headersList = await headers();
  const userAgent = headersList.get("user-agent") || null;
  const ipAddress = headersList.get("x-forwarded-for")?.split(",")[0] || headersList.get("x-real-ip") || null;

  // Insert session in the database
  const dbSession = await prisma.session.create({
    data: {
      userId: payload.userId,
      ipAddress,
      userAgent,
    },
  });

  const token = await new SignJWT({
    userId: payload.userId,
    username: payload.username,
    sessionId: dbSession.id,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const sessionId = payload.sessionId as string;
    if (!sessionId) return null;

    // Check if session exists in DB
    const dbSession = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!dbSession) {
      // Session has been revoked!
      cookieStore.delete(SESSION_COOKIE);
      return null;
    }

    // Refresh lastActiveAt with a 5-minute threshold to optimize write performance
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    if (dbSession.lastActiveAt < fiveMinutesAgo) {
      prisma.session.update({
        where: { id: sessionId },
        data: { lastActiveAt: now },
      }).catch(() => {});
    }

    return {
      userId: payload.userId as string,
      username: payload.username as string,
      sessionId,
    };
  } catch {
    return null;
  }
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSecretKey());
      const sessionId = payload.sessionId as string;
      if (sessionId) {
        await prisma.session.delete({
          where: { id: sessionId },
        }).catch(() => {});
      }
    } catch {
      // Ignore verification errors during session deletion
    }
  }
  cookieStore.delete(SESSION_COOKIE);
}
