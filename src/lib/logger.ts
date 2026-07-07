export interface LogPayload {
  level: "info" | "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export const logger = {
  log(payload: LogPayload) {
    const logData = {
      timestamp: new Date().toISOString(),
      ...payload,
    };
    if (payload.level === "error") {
      console.error(JSON.stringify(logData));
    } else if (payload.level === "warn") {
      console.warn(JSON.stringify(logData));
    } else {
      console.log(JSON.stringify(logData));
    }
  },
  info(message: string, context?: Record<string, unknown>) {
    this.log({ level: "info", message, context });
  },
  warn(message: string, context?: Record<string, unknown>) {
    this.log({ level: "warn", message, context });
  },
  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    const errObj = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error ? {
      name: "UnknownError",
      message: String(error),
    } : undefined;

    this.log({ level: "error", message, error: errObj, context });
  }
};
