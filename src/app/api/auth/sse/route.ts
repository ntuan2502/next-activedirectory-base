import { getSession } from "@/lib/session";
import { sseManager } from "@/lib/sse";
import { getServerTranslator } from "@/lib/i18n";
import { getUserPermissions } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  const { t } = await getServerTranslator();

  if (!session) {
    return new Response(t("errors.unauthorized"), { status: 401 });
  }

  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  // Helper to send a clean SSE message
  const sendEvent = async (type: string, data: unknown) => {
    try {
      const formatted = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(formatted));
    } catch (err) {
      console.error(t("logs.failedToWriteSse"), err);
      cleanup();
    }
  };

  // Send initial connected confirmation
  sendEvent("connected", {
    userId: session.userId,
    sessionId: session.sessionId,
  });

  // Setup heartbeat ping to keep connection alive and detect disconnects
  const pingInterval = setInterval(async () => {
    try {
      await writer.write(encoder.encode(": ping\n\n"));
    } catch {
      cleanup();
    }
  }, 15000);

  // Subscribe to changes for this user
  const unsubscribe = sseManager.subscribe(session.userId, async (event) => {
    // Security check: Only broadcast audit log events to users who have audit logs reading permission
    if (event.type === "AUDIT_LOG_CREATED") {
      const userPermissions = await getUserPermissions(session.userId);
      const hasPermission = userPermissions.includes("*") || userPermissions.includes("audit_logs:read");
      if (!hasPermission) return;
    }

    await sendEvent(event.type, {
      sessionId: event.sessionId,
      payload: event.payload,
    });
  });

  const cleanup = () => {
    clearInterval(pingInterval);
    unsubscribe();
    try {
      writer.close();
    } catch {
      // Ignore double-close errors
    }
  };

  // Handle client disconnect
  request.signal.addEventListener("abort", () => {
    cleanup();
  });

  return new Response(responseStream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
