import { EventEmitter } from "events";

export type SseEvent = {
  userId: string;
  type: "SETTINGS_UPDATED" | "PERMISSIONS_UPDATED" | "SESSION_REVOKED" | "FORCE_LOGOUT";
  sessionId?: string;
  payload?: unknown;
};

class SseManager {
  private emitter = new EventEmitter();

  constructor() {
    // Increase listener limits for multiple parallel tab connections
    this.emitter.setMaxListeners(100);
  }

  // Subscribe to changes for a specific user ID
  subscribe(userId: string, onEvent: (event: SseEvent) => void) {
    const listener = (event: SseEvent) => {
      if (event.userId === userId) {
        onEvent(event);
      }
    };

    this.emitter.on("change", listener);
    return () => {
      this.emitter.off("change", listener);
    };
  }

  // Publish a new SSE event
  publish(event: SseEvent) {
    this.emitter.emit("change", event);
  }
}

// Store the manager instance globally to prevent resetting on Next.js HMR reloads
const globalForSse = global as unknown as { sseManager?: SseManager };
export const sseManager = globalForSse.sseManager || new SseManager();

if (process.env.NODE_ENV !== "production") {
  globalForSse.sseManager = sseManager;
}
