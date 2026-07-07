import { withLdapClient, getAttr, LDAP_USER_ATTRIBUTES } from "@/lib/ldap";
import { prisma } from "@/lib/db";
import { logAction } from "@/modules/audit-logs/services";
import { LdapUserPreview, LdapCompanySyncDetail, LdapDepartmentSyncDetail, LdapSyncDetail } from "./types";

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

function toPascalCase(str: string): string {
  if (!str) return "";
  const words = str.split(/[^a-zA-Z0-9\p{L}\p{N}]+/u).filter(Boolean);
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

export async function syncLdapUsers(usernamesToSync?: string[]) {
  const ldapUsers = await fetchLdapUsers();
  
  const usersToSync = ldapUsers.filter((u) => {
    const isTarget = usernamesToSync ? usernamesToSync.includes(u.username) : true;
    return !!(u.isSyncable && isTarget && u.username);
  });

  if (usersToSync.length === 0) {
    return { syncedCount: 0, usersCreated: [], usersUpdated: [], syncDetails: [] };
  }

  const existingUsers = await prisma.user.findMany({
    where: { username: { in: usersToSync.map((u) => u.username) } },
    include: {
      companies: true,
      departments: true,
    },
  });

  const companies = await prisma.company.findMany();
  const companyMap = new Map<string, string>();
  const companyIdToCode = new Map<string, string>();
  for (const comp of companies) {
    companyMap.set(comp.code.toUpperCase(), comp.id);
    companyIdToCode.set(comp.id, comp.code.toUpperCase());
  }

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
      companyIdToCode.set(newCompany.id, newCompany.code.toUpperCase());
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

  const departments = await prisma.department.findMany();
  const departmentMap = new Map<string, string>();
  for (const dept of departments) {
    const codeKey = `${dept.companyId}_code:${dept.code.toUpperCase()}`;
    const nameViKey = `${dept.companyId}_namevi:${dept.nameVi.toLowerCase()}`;
    const nameEnKey = `${dept.companyId}_nameen:${dept.nameEn.toLowerCase()}`;
    departmentMap.set(codeKey, dept.id);
    if (dept.nameVi) departmentMap.set(nameViKey, dept.id);
    if (dept.nameEn) departmentMap.set(nameEnKey, dept.id);
  }

  const departmentsCreatedDetails: LdapDepartmentSyncDetail[] = [];
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

    let deptId: string | null = null;
    if (companyId && user.department && user.department.trim() !== "") {
      const deptName = user.department.trim();
      const companyCode = companyIdToCode.get(companyId) || "";
      const deptPascal = toPascalCase(deptName);
      let deptCode = companyCode ? `${companyCode}_${deptPascal || "UNKNOWN"}` : (deptPascal || "UNKNOWN");
      if (!deptCode) deptCode = "UNKNOWN";

      const codeKey = `${companyId}_code:${deptCode}`;
      const nameKey = `${companyId}_namevi:${deptName.toLowerCase()}`;
      
      deptId = departmentMap.get(codeKey) || departmentMap.get(nameKey) || null;

      if (!deptId) {
        const newDept = await prisma.department.create({
          data: {
            code: deptCode,
            nameVi: deptName,
            nameEn: deptName,
            companyId,
          },
          include: {
            companyObj: true,
          }
        });
        deptId = newDept.id;
        departmentMap.set(codeKey, deptId);
        departmentMap.set(nameKey, deptId);
        departmentMap.set(`${companyId}_nameen:${deptName.toLowerCase()}`, deptId);
        
        departmentsCreatedDetails.push({
          code: newDept.code,
          before: null,
          after: {
            id: newDept.id,
            code: newDept.code,
            nameVi: newDept.nameVi,
            nameEn: newDept.nameEn,
            companyId: newDept.companyId,
            companyCode: newDept.companyObj?.code || "",
            createdAt: newDept.createdAt.toISOString(),
            updatedAt: newDept.updatedAt.toISOString(),
          },
        });
      }
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
            companies: companyId ? {
              connect: { id: companyId }
            } : undefined,
            departments: deptId ? {
              connect: { id: deptId }
            } : undefined,
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
    include: {
      companies: true,
      departments: true,
    },
  });

  const syncedCount = usersCreated.length + usersUpdated.length;

  const syncDetails = [];
  for (const user of usersCreated) {
    const latestUser = latestDbUsers.find((lu) => lu.username === user.username);
    if (latestUser) {
      syncDetails.push({
        username: user.username,
        before: null,
        after: {
          id: latestUser.id,
          username: latestUser.username,
          displayName: latestUser.displayName,
          firstName: latestUser.firstName,
          lastName: latestUser.lastName,
          email: latestUser.email,
          phone: latestUser.phone,
          title: latestUser.title,
          employeeId: latestUser.employeeId,
          company: latestUser.companies.map((c) => c.code).join(", "),
          department: latestUser.departments.map((d) => d.code).join(", "),
          createdAt: latestUser.createdAt.toISOString(),
          updatedAt: latestUser.updatedAt.toISOString(),
        },
      });
    }
  }

  for (const user of usersUpdated) {
    const oldUser = existingUsers.find((eu) => eu.username === user.username);
    const latestUser = latestDbUsers.find((lu) => lu.username === user.username);
    if (latestUser && oldUser) {
      syncDetails.push({
        username: user.username,
        before: {
          id: oldUser.id,
          username: oldUser.username,
          displayName: oldUser.displayName,
          firstName: oldUser.firstName,
          lastName: oldUser.lastName,
          email: oldUser.email,
          phone: oldUser.phone,
          title: oldUser.title,
          employeeId: oldUser.employeeId,
          company: oldUser.companies.map((c) => c.code).join(", "),
          department: oldUser.departments.map((d) => d.code).join(", "),
          createdAt: oldUser.createdAt.toISOString(),
          updatedAt: oldUser.updatedAt.toISOString(),
        },
        after: {
          id: latestUser.id,
          username: latestUser.username,
          displayName: latestUser.displayName,
          firstName: latestUser.firstName,
          lastName: latestUser.lastName,
          email: latestUser.email,
          phone: latestUser.phone,
          title: latestUser.title,
          employeeId: latestUser.employeeId,
          company: latestUser.companies.map((c) => c.code).join(", "),
          department: latestUser.departments.map((d) => d.code).join(", "),
          createdAt: latestUser.createdAt.toISOString(),
          updatedAt: latestUser.updatedAt.toISOString(),
        },
      });
    }
  }

  return {
    syncedCount,
    usersCreated,
    usersUpdated,
    syncDetails,
    companiesCreated: companiesCreatedDetails,
    departmentsCreated: departmentsCreatedDetails,
  };
}

export async function logLdapSyncResult(
  result: {
    syncedCount: number;
    syncDetails: LdapSyncDetail[];
    companiesCreated?: LdapCompanySyncDetail[];
    departmentsCreated?: LdapDepartmentSyncDetail[];
    usersCreated?: { username: string }[];
    usersUpdated?: { username: string }[];
  } | null,
  errorObj?: { key: string; params?: Record<string, unknown> } | null
) {
  if (errorObj) {
    await logAction("ldap:sync_users", null, {
      status: "failed",
      message: errorObj.key,
      data: errorObj,
    });
    return;
  }

  if (result) {
    const createdCount = result.usersCreated?.length ?? result.syncDetails.filter((d) => d.before === null).length;
    const updatedCount = result.usersUpdated?.length ?? result.syncDetails.filter((d) => d.before !== null).length;
    const companyCount = result.companiesCreated?.length ?? 0;
    const departmentCount = result.departmentsCreated?.length ?? 0;

    if (companyCount > 0) {
      await logAction("ldap:sync_companies", null, {
        status: "success",
        message: "auditLogsPage.messages.ldapSyncCompaniesSuccess",
        data: {
          companies: result.companiesCreated || [],
          count: companyCount,
        },
      });
    }

    if (departmentCount > 0) {
      await logAction("ldap:sync_departments", null, {
        status: "success",
        message: "auditLogsPage.messages.ldapSyncDepartmentsSuccess",
        data: {
          departments: result.departmentsCreated || [],
          count: departmentCount,
        },
      });
    }

    await logAction("ldap:sync_users", null, {
      status: "success",
      message: "auditLogsPage.messages.ldapSyncUsersSuccess",
      data: {
        usernames: result.syncDetails.map((u) => u.username),
        details: result.syncDetails,
        createdCount,
        updatedCount,
        syncedCount: result.syncedCount,
      },
    });
  }
}
