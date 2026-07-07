export interface AuditLogDetails {
  status: "success" | "failed";
  message: string;
  data: unknown;
}
