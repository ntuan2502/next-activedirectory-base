import { NextResponse } from "next/server";
import { withLdapClient } from "@/lib/ldap";

export async function POST() {
  try {
    await withLdapClient(async () => {
      // Bind is handled by withLdapClient — if we reach here, connection is OK
    });

    return NextResponse.json({ success: true, message: "Connection successful" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to connect to LDAP server";
    console.error("LDAP Test Connection Error:", error);
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
