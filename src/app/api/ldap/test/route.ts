import { NextResponse } from "next/server";
import { withLdapClient, getLdapConfig } from "@/lib/ldap";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/audit";

export async function POST() {
  const authResponse = await requirePermission(PERMISSIONS.LDAP_TEST);
  if (authResponse) return authResponse;

  let configDetails: {
    url: string;
    port: string;
    username: string;
    baseDN: string;
    filter: string;
  } | null = null;

  try {
    const config = getLdapConfig();
    configDetails = {
      url: config.url,
      port: config.port,
      username: config.username,
      baseDN: config.baseDN,
      filter: config.filter,
    };
  } catch {
    // Config variables could be completely missing
  }

  try {
    await withLdapClient(async () => {
      // Bind is handled by withLdapClient — if we reach here, connection is OK
    });

    await logAction("ldap:test_connection", "success", {
      success: true,
      message: "Connection successful",
      config: configDetails,
    });
    return NextResponse.json({ success: true, message: "Connection successful" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to connect to LDAP server";
    console.error("LDAP Test Connection Error:", error);
    await logAction("ldap:test_connection", "failed", {
      success: false,
      error: message,
      config: configDetails,
    });
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
