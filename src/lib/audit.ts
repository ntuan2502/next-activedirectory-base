import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";

export async function logAction(
  action: string,
  target?: string | null,
  details?: unknown,
  overrideUser?: { userId: string; username: string }
) {
  try {
    const session = await getSession();
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
      detailsString = typeof details === "string" ? details : JSON.stringify(details, null, 2);
    }

    const userId = overrideUser?.userId || session?.userId || null;
    const username = overrideUser?.username || session?.username || "system";

    await prisma.auditLog.create({
      data: {
        userId,
        username,
        action,
        target: target || null,
        details: detailsString,
        ipAddress,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}
