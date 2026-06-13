import { withLdapClient, getAttr, LDAP_USER_ATTRIBUTES } from "@/lib/ldap";
import { prisma } from "@/lib/db";
import { logAction } from "@/lib/audit";

export interface LdapUserPreview {
  dn: string;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  title: string;
  department: string;
  company: string;
  employeeId: string;
  manager: string;
  phone: string;
}

export async function fetchLdapUsers(): Promise<LdapUserPreview[]> {
  return await withLdapClient(async (client, config) => {
    const { searchEntries } = await client.search(config.baseDN, {
      scope: "sub",
      filter: config.filter,
      attributes: LDAP_USER_ATTRIBUTES,
      paged: { pageSize: 1000 },
    });

    return searchEntries.map((entry) => ({
      dn: entry.dn || "",
      username: (getAttr(entry, "sAMAccountName") || getAttr(entry, "userPrincipalName") || "").toLowerCase(),
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

export async function syncLdapUsers(usernamesToSync?: string[]) {
  const ldapUsers = await fetchLdapUsers();
  
  // Filter to only those requested (if specified) and those with an email
  const usersToSync = ldapUsers.filter((u) => {
    const hasEmail = u.email && u.email.trim() !== "";
    const isTarget = usernamesToSync ? usernamesToSync.includes(u.username) : true;
    return !!(hasEmail && isTarget && u.username);
  });

  if (usersToSync.length === 0) {
    return { syncedCount: 0, usersCreated: [], usersUpdated: [] };
  }

  const existingUsers = await prisma.user.findMany({
    where: { username: { in: usersToSync.map((u) => u.username) } },
  });

  const now = new Date();
  const syncOperations = [];
  const usersCreated = [];
  const usersUpdated = [];

  for (const user of usersToSync) {
    const dbUser = existingUsers.find((eu) => eu.username === user.username);

    if (!dbUser) {
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

  if (syncOperations.length > 0) {
    await prisma.$transaction(syncOperations);
  }

  const syncedCount = usersCreated.length + usersUpdated.length;

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
        company: user.company,
      },
    });
  }

  for (const user of usersUpdated) {
    const dbUser = existingUsers.find((eu) => eu.username === user.username);
    syncDetails.push({
      username: user.username,
      before: dbUser
        ? {
            dn: dbUser.dn,
            displayName: dbUser.displayName,
            email: dbUser.email,
            phone: dbUser.phone,
            title: dbUser.title,
            department: dbUser.department,
            company: dbUser.company,
          }
        : null,
      after: {
        dn: user.dn,
        displayName: user.displayName,
        email: user.email,
        phone: user.phone,
        title: user.title,
        department: user.department,
        company: user.company,
      },
    });
  }

  if (syncedCount > 0) {
    await logAction("ldap:sync_data", `${syncedCount} users`, {
      usernames: usersToSync.map((u) => u.username),
      details: syncDetails,
    });
  }

  return {
    syncedCount,
    usersCreated,
    usersUpdated,
  };
}
