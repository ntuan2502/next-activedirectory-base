import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { sseManager } from "@/lib/sse";

export interface AuditLogDetails {
  status: "success" | "failed";
  message: string;
  data: unknown;
}

export async function logAction(
  action: string,
  target?: string | null,
  details?: AuditLogDetails | null,
  overrideUser?: { userId: string; username: string }
) {
  try {
    let session = null;
    try {
      session = await getSession();
    } catch {
      // Fallback if cookies() is called outside request scope
    }
    let ipAddress: string | null = null;
    
    try {
      const headersList = await headers();
      ipAddress = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || null;
      if (ipAddress && ipAddress.includes(",")) {
        ipAddress = ipAddress.split(",")[0].trim();
      }
    } catch {
      // Fallback if headers are not available (e.g., build time or background jobs)
    }

    let detailsString = null;
    if (details) {
      detailsString = JSON.stringify(details, null, 2);
    }

    const userId = overrideUser?.userId || session?.userId || null;
    const username = overrideUser?.username || session?.username || "system";

    const createdLog = await prisma.auditLog.create({
      data: {
        userId,
        username,
        action,
        target: target || null,
        details: detailsString,
        ipAddress,
      },
      include: {
        user: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
    });

    sseManager.publish({
      userId: "*",
      type: "AUDIT_LOG_CREATED",
      payload: {
        id: createdLog.id,
        userId: createdLog.userId,
        username: createdLog.username,
        action: createdLog.action,
        target: createdLog.target,
        details: createdLog.details,
        ipAddress: createdLog.ipAddress,
        createdAt: createdLog.createdAt.toISOString(),
        user: createdLog.user,
      },
    });
  } catch (error) {
    console.error(error);
  }
}
