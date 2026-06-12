import { NextRequest, NextResponse } from "next/server";
import { withLdapClient, getAttr, LDAP_USER_ATTRIBUTES } from "@/lib/ldap";
import { prisma } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/audit";

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
      company: getAttr(entry, "company"),
      employeeId: getAttr(entry, "employeeID"),
      manager: getAttr(entry, "manager"),
      phone: getAttr(entry, "mobile"),
    }));
  });
}

// GET: Return a preview of LDAP users
export async function GET() {
  const authResponse = await requirePermission(PERMISSIONS.LDAP_SYNC);
  if (authResponse) return authResponse;

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
  const authResponse = await requirePermission(PERMISSIONS.LDAP_SYNC);
  if (authResponse) return authResponse;

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

    const existingUsers = await prisma.user.findMany({
      where: { username: { in: usersToSync.map(u => u.username) } }
    });

    const now = new Date();
    const syncOperations = [];
    const usersCreated = [];
    const usersUpdated = [];

    for (const user of usersToSync) {
      if (!user.username) continue;

      const dbUser = existingUsers.find((eu) => eu.username === user.username);

      if (!dbUser) {
        // User is new -> Create
        usersCreated.push(user);
        syncOperations.push(
          prisma.user.create({
            data: {
              dn: user.dn,
              username: user.username,
              displayName: user.displayName || "",
              firstName: user.firstName || "",
              lastName: user.lastName || "",
              email: user.email || "",
              phone: user.phone || "",
              title: user.title || "",
              department: user.department || "",
              company: user.company || "",
              employeeId: user.employeeId || "",
              manager: user.manager || "",
              lastSyncAt: now,
            },
          })
        );
      } else {
        // User exists -> Check if any properties changed
        const hasChanges =
          dbUser.dn !== (user.dn || "") ||
          dbUser.displayName !== (user.displayName || "") ||
          dbUser.firstName !== (user.firstName || "") ||
          dbUser.lastName !== (user.lastName || "") ||
          dbUser.email !== (user.email || "") ||
          dbUser.phone !== (user.phone || "") ||
          dbUser.title !== (user.title || "") ||
          dbUser.department !== (user.department || "") ||
          dbUser.company !== (user.company || "") ||
          dbUser.employeeId !== (user.employeeId || "") ||
          dbUser.manager !== (user.manager || "");

        if (hasChanges) {
          usersUpdated.push(user);
          syncOperations.push(
            prisma.user.update({
              where: { username: user.username },
              data: {
                dn: user.dn,
                displayName: user.displayName || "",
                firstName: user.firstName || "",
                lastName: user.lastName || "",
                email: user.email || "",
                phone: user.phone || "",
                title: user.title || "",
                department: user.department || "",
                company: user.company || "",
                employeeId: user.employeeId || "",
                manager: user.manager || "",
                lastSyncAt: now,
              },
            })
          );
        }
      }
    }

    // Execute bulk writes only for users with actual changes
    if (syncOperations.length > 0) {
      await prisma.$transaction(syncOperations);
    }
    const syncedCount = usersCreated.length + usersUpdated.length;

    // Return all users from database for the UI list
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
        company: true,
        employeeId: true,
        manager: true,
        lastSyncAt: true,
        disabled: true,
      },
    });

    // Generate details logs only for created/updated records (exclude skipped ones)
    const syncDetails = [];
    
    for (const user of usersCreated) {
      syncDetails.push({
        username: user.username,
        before: null,
        after: {
          dn: user.dn,
          displayName: user.displayName,
          email: user.email,
          phone: user.phone,
          title: user.title,
          department: user.department,
          company: user.company
        }
      });
    }

    for (const user of usersUpdated) {
      const dbUser = existingUsers.find((eu) => eu.username === user.username);
      syncDetails.push({
        username: user.username,
        before: dbUser ? {
          dn: dbUser.dn,
          displayName: dbUser.displayName,
          email: dbUser.email,
          phone: dbUser.phone,
          title: dbUser.title,
          department: dbUser.department,
          company: dbUser.company
        } : null,
        after: {
          dn: user.dn,
          displayName: user.displayName,
          email: user.email,
          phone: user.phone,
          title: user.title,
          department: user.department,
          company: user.company
        }
      });
    }

    // Only log if something actually synced (created or updated)
    if (syncedCount > 0) {
      await logAction("ldap:sync_data", `${syncedCount} users`, {
        usernames: usernamesToSync,
        details: syncDetails
      });
    }

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
