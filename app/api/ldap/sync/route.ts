import { NextResponse } from "next/server";
import { withLdapClient, getAttr, LDAP_USER_ATTRIBUTES } from "@/lib/ldap";

export async function POST() {
  try {
    const users = await withLdapClient(async (client, config) => {
      const { searchEntries } = await client.search(config.baseDN, {
        scope: "sub",
        filter: config.filter,
        attributes: LDAP_USER_ATTRIBUTES,
        paged: { pageSize: 1000 },
      });

      return (searchEntries as any[]).map((entry) => ({
        dn: entry.dn || entry.objectName || "",
        username: getAttr(entry, "sAMAccountName") || getAttr(entry, "userPrincipalName"),
        firstName: getAttr(entry, "givenName"),
        lastName: getAttr(entry, "sn"),
        displayName: getAttr(entry, "displayName"),
        email: getAttr(entry, "mail"),
        title: getAttr(entry, "title"),
        department: getAttr(entry, "department"),
        employeeId: getAttr(entry, "employeeID"),
        manager: getAttr(entry, "manager"),
        phone: getAttr(entry, "mobile"),
      }));
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error: any) {
    console.error("LDAP Sync Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to synchronize data from LDAP" },
      { status: 400 }
    );
  }
}
