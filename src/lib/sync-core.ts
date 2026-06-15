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
  isSyncable?: boolean;
  isTest?: boolean;
}

export async function fetchLdapUsers(): Promise<LdapUserPreview[]> {
  return await withLdapClient(async (client, config) => {
    const { searchEntries } = await client.search(config.baseDN, {
      scope: "sub",
      filter: config.filter,
      attributes: LDAP_USER_ATTRIBUTES,
      paged: { pageSize: 1000 },
    });

    return searchEntries.map((entry) => {
      const email = getAttr(entry, "mail") || "";
      const username = (getAttr(entry, "sAMAccountName") || getAttr(entry, "userPrincipalName") || "").toLowerCase();
      const displayName = getAttr(entry, "displayName") || "";
      
      const hasEmail = email && email.trim() !== "";
      const isTest = username.toLowerCase().includes("test") ||
        displayName.toLowerCase().includes("test") ||
        (email || "").toLowerCase().includes("test");
      const isSyncable = !!(hasEmail && !isTest);

      return {
        dn: entry.dn || "",
        username,
        firstName: getAttr(entry, "givenName"),
        lastName: getAttr(entry, "sn"),
        displayName,
        email,
        title: getAttr(entry, "title"),
        department: getAttr(entry, "department"),
        company: getAttr(entry, "company"),
        employeeId: getAttr(entry, "employeeID"),
        manager: getAttr(entry, "manager"),
        phone: getAttr(entry, "mobile"),
        isSyncable,
        isTest,
      };
    });
  });
}

function parseCompanyCodeFromDn(dn: string): string | null {
  if (!dn) return null;
  const parts = dn.split(",");
  const usersIndex = parts.findIndex((part) => part.trim().toUpperCase() === "OU=USERS");
  if (usersIndex > 0) {
    const companyPart = parts[usersIndex - 1].trim();
    const match = companyPart.match(/^OU=(.+)$/i);
    if (match) {
      return match[1].toUpperCase();
    }
  }
  return null;
}

export async function syncLdapUsers(usernamesToSync?: string[]) {
  const ldapUsers = await fetchLdapUsers();
  
  // Filter to only those requested (if specified) and those that are syncable
  const usersToSync = ldapUsers.filter((u) => {
    const isTarget = usernamesToSync ? usernamesToSync.includes(u.username) : true;
    return !!(u.isSyncable && isTarget && u.username);
  });

  if (usersToSync.length === 0) {
    return { syncedCount: 0, usersCreated: [], usersUpdated: [], syncDetails: [] };
  }

  const existingUsers = await prisma.user.findMany({
    where: { username: { in: usersToSync.map((u) => u.username) } },
  });

  const companies = await prisma.company.findMany();
  const companyMap = new Map<string, string>();
  for (const comp of companies) {
    companyMap.set(comp.code.toUpperCase(), comp.id);
  }

  // Thu thập các code công ty cần thiết từ danh sách đồng bộ
  const requiredCodes = new Set<string>();
  for (const user of usersToSync) {
    const detectedCode = parseCompanyCodeFromDn(user.dn);
    if (detectedCode) {
      requiredCodes.add(detectedCode.toUpperCase());
    }
    if (user.company) {
      requiredCodes.add(user.company.toUpperCase());
    }
  }

  // Tự động tạo các công ty chưa tồn tại trong cơ sở dữ liệu
  const companiesCreatedDetails: LdapCompanySyncDetail[] = [];
  for (const code of requiredCodes) {
    if (!companyMap.has(code)) {
      const newCompany = await prisma.company.create({
        data: {
          code: code,
          nameVi: "",
          nameEn: "",
          taxAddress: "",
          taxCode: "",
        },
      });
      companyMap.set(code, newCompany.id);
      companiesCreatedDetails.push({
        code: newCompany.code,
        before: null,
        after: {
          id: newCompany.id,
          code: newCompany.code,
          nameVi: newCompany.nameVi,
          nameEn: newCompany.nameEn,
          taxAddress: newCompany.taxAddress,
          taxCode: newCompany.taxCode,
          createdAt: newCompany.createdAt.toISOString(),
          updatedAt: newCompany.updatedAt.toISOString(),
        },
      });
    }
  }

  const now = new Date();
  const syncOperations = [];
  const usersCreated = [];
  const usersUpdated = [];

  for (const user of usersToSync) {
    const dbUser = existingUsers.find((eu) => eu.username === user.username);

    let companyId: string | null = null;
    const detectedCode = parseCompanyCodeFromDn(user.dn);
    if (detectedCode) {
      companyId = companyMap.get(detectedCode.toUpperCase()) || null;
    }

    if (!companyId && user.company) {
      companyId = companyMap.get(user.company.toUpperCase()) || null;
    }

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
            companyId: companyId,
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
        dbUser.companyId !== companyId ||
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
              companyId: companyId,
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

  const latestDbUsers = await prisma.user.findMany({
    where: { username: { in: usersToSync.map((u) => u.username) } },
  });

  const syncedCount = usersCreated.length + usersUpdated.length;

  const syncDetails = [];
  for (const user of usersCreated) {
    const latestUser = latestDbUsers.find((lu) => lu.username === user.username);
    if (latestUser) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash: _, ...userWithoutPassword } = latestUser;
      syncDetails.push({
        username: user.username,
        before: null,
        after: userWithoutPassword,
      });
    }
  }

  for (const user of usersUpdated) {
    const oldUser = existingUsers.find((eu) => eu.username === user.username);
    const latestUser = latestDbUsers.find((lu) => lu.username === user.username);
    if (latestUser && oldUser) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash: _1, ...oldUserWithoutPassword } = oldUser;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash: _2, ...latestUserWithoutPassword } = latestUser;
      syncDetails.push({
        username: user.username,
        before: oldUserWithoutPassword,
        after: latestUserWithoutPassword,
      });
    }
  }

  return {
    syncedCount,
    usersCreated,
    usersUpdated,
    syncDetails,
    companiesCreated: companiesCreatedDetails,
  };
}

export interface LdapCompanySyncDetail {
  code: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
}

export interface LdapSyncDetail {
  username: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
}

export async function logLdapSyncResult(
  result: {
    syncedCount: number;
    syncDetails: LdapSyncDetail[];
    companiesCreated?: LdapCompanySyncDetail[];
    usersCreated?: { username: string }[];
    usersUpdated?: { username: string }[];
  } | null,
  errorObj?: { key: string; params?: Record<string, unknown> } | null
) {
  if (errorObj) {
    await logAction("ldap:sync_data", "failed", errorObj);
  } else if (result) {
    const createdCount = result.usersCreated?.length ?? result.syncDetails.filter((d) => d.before === null).length;
    const updatedCount = result.usersUpdated?.length ?? result.syncDetails.filter((d) => d.before !== null).length;
    const companyCount = result.companiesCreated?.length ?? 0;

    let targetStr: string;
    if (companyCount > 0) {
      targetStr = `${createdCount} created, ${updatedCount} updated, ${companyCount} companies`;
    } else if (createdCount > 0 && updatedCount > 0) {
      targetStr = `${createdCount} created, ${updatedCount} updated`;
    } else if (createdCount > 0) {
      targetStr = `${createdCount} users created`;
    } else if (updatedCount > 0) {
      targetStr = `${updatedCount} users updated`;
    } else {
      targetStr = `${result.syncedCount} users`;
    }

    await logAction("ldap:sync_data", targetStr, {
      usernames: result.syncDetails.map((u) => u.username),
      details: result.syncDetails,
      companiesCreated: result.companiesCreated || [],
      createdCount,
      updatedCount,
    });
  }
}
