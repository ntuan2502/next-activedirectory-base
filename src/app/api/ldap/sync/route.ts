import { NextRequest, NextResponse } from "next/server";
import { withLdapClient, getAttr, LDAP_USER_ATTRIBUTES } from "@/lib/ldap";
import { prisma } from "@/lib/db";

async function fetchLdapUsers() {
  return await withLdapClient(async (client, config) => {
    const { searchEntries } = await client.search(config.baseDN, {
      scope: "sub",
      filter: config.filter,
      attributes: LDAP_USER_ATTRIBUTES,
      paged: { pageSize: 1000 },
    });

    return searchEntries.map((entry) => ({
      dn: entry.dn || "",
      username: (getAttr(entry, "sAMAccountName") || getAttr(entry, "userPrincipalName")).toLowerCase(),
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
}

// GET: Return a preview of LDAP users
export async function GET() {
  try {
    const ldapUsers = await fetchLdapUsers();

    return NextResponse.json({
      success: true,
      data: ldapUsers,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch preview data from LDAP";
    console.error("LDAP Preview Error:", error);
    return NextResponse.json(
      { error: message },
      { status: 400 },
    );
  }
}

// POST: Sync specifically selected users
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { usernamesToSync } = body;

    if (!usernamesToSync || !Array.isArray(usernamesToSync)) {
      return NextResponse.json({ error: "Invalid payload. Expected 'usernamesToSync' array." }, { status: 400 });
    }

    const ldapUsers = await fetchLdapUsers();
    
    // Filter to only those requested and those with an email
    const usersToSync = ldapUsers.filter(
      (u) => usernamesToSync.includes(u.username) && u.email && u.email.trim() !== ""
    );

    const now = new Date();
    let syncedCount = 0;

    for (const user of usersToSync) {
      if (!user.username) continue;

      await prisma.user.upsert({
        where: { username: user.username },
        update: {
          dn: user.dn,
          displayName: user.displayName,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          title: user.title,
          department: user.department,
          employeeId: user.employeeId,
          manager: user.manager,
          lastSyncAt: now,
        },
        create: {
          dn: user.dn,
          username: user.username,
          displayName: user.displayName,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          title: user.title,
          department: user.department,
          employeeId: user.employeeId,
          manager: user.manager,
          lastSyncAt: now,
        },
      });
      syncedCount++;
    }

    // Return all users from database
    const dbUsers = await prisma.user.findMany({
      orderBy: { username: "asc" },
      select: {
        id: true,
        dn: true,
        username: true,
        displayName: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        title: true,
        department: true,
        employeeId: true,
        manager: true,
        lastSyncAt: true,
        disabled: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: dbUsers,
      syncedCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to synchronize data from LDAP";
    console.error("LDAP Sync Error:", error);
    return NextResponse.json(
      { error: message },
      { status: 400 },
    );
  }
}
