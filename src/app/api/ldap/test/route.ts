import { NextRequest, NextResponse } from "next/server";
import { getLdapConfig, createLdapClient } from "@/lib/ldap";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const authResponse = await requirePermission(PERMISSIONS.LDAP_TEST);
  if (authResponse) return authResponse;

  let config = await getLdapConfig();
  
  try {
    const body = await request.json();
    if (body && typeof body === "object") {
      config = {
        url: body.ldapUrl || config.url,
        port: String(body.ldapPort || config.port),
        username: body.ldapBindDn || config.username,
        password: body.ldapBindPassword && body.ldapBindPassword !== "********" ? body.ldapBindPassword : config.password,
        baseDN: body.ldapBaseDn || config.baseDN,
        filter: body.ldapFilter || config.filter,
      };
    }
  } catch {
    // Ignore body parsing if not provided or invalid
  }

  const configDetails = {
    url: config.url,
    port: config.port,
    username: config.username,
    baseDN: config.baseDN,
    filter: config.filter,
  };

  try {
    const client = createLdapClient(config);
    await client.bind(config.username, config.password);
    await client.unbind();

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
