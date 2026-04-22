import { Client } from "ldapts";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getLdapConfig, createLdapClient } from "@/lib/ldap";

type AuthResult = {
  userId: string;
  username: string;
  displayName: string;
};

export async function authenticateUser(
  username: string,
  password: string,
): Promise<AuthResult> {
  const dbUser = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
  });

  if (dbUser?.disabled) {
    throw new Error("Your account has been disabled. Please contact an administrator.");
  }

  const config = getLdapConfig();

  // Step 1: Try LDAP authentication
  try {
    const result = await authenticateViaLdap(username, password, config);
    return result;
  } catch (ldapError: unknown) {
    const isConnectionError = isLdapConnectionError(ldapError);

    if (!isConnectionError) {
      // LDAP responded but credentials are invalid
      throw new Error("Invalid username or password.");
    }

    // Step 2: LDAP unreachable — fallback to cached password
    console.warn("LDAP unreachable, falling back to cached credentials.");
    return authenticateViaCachedPassword(username, password);
  }
}

async function authenticateViaLdap(
  username: string,
  password: string,
  config: ReturnType<typeof getLdapConfig>,
): Promise<AuthResult> {
  const client: Client = createLdapClient(config);

  // Bind with user's own credentials
  const userDn = username.includes("@") ? username : `${username}@${extractDomain(config.baseDN)}`;

  try {
    await client.bind(userDn, password);
    await client.unbind();
  } catch (error) {
    try { await client.unbind(); } catch { /* ignore */ }
    throw error;
  }

  // Auth successful — hash and cache password in DB
  const passwordHash = await bcrypt.hash(password, 12);

  // Check if this is the first user in the system
  const userCount = await prisma.user.count();
  const isFirstUser = userCount === 0;

  // Ensure Super Admin role exists
  let roleCheck = await prisma.role.findFirst({ where: { isSystem: true } });
  if (!roleCheck && isFirstUser) {
    roleCheck = await prisma.role.create({
      data: {
        name: "Super Admin",
        description: "Built-in system administrator with full access",
        permissions: '["*"]',
        isSystem: true,
      },
    });
  }

  const createData: any = {
    username: username.toLowerCase(),
    passwordHash,
    lastLoginAt: new Date(),
  };

  // Only assign Super Admin if this is the very first user in the entire database
  if (isFirstUser && roleCheck) {
    createData.roles = {
      connect: { id: roleCheck.id },
    };
  }

  const user = await prisma.user.upsert({
    where: { username: username.toLowerCase() },
    update: {
      passwordHash,
      lastLoginAt: new Date(),
    },
    create: createData,
  });

  return {
    userId: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
  };
}

async function authenticateViaCachedPassword(
  username: string,
  password: string,
): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
  });

  if (!user || !user.passwordHash) {
    throw new Error("LDAP server is unreachable and no cached credentials found.");
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new Error("Invalid username or password.");
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    userId: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
  };
}

function isLdapConnectionError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("connect") ||
      msg.includes("econnrefused") ||
      msg.includes("etimedout") ||
      msg.includes("enotfound") ||
      msg.includes("socket") ||
      msg.includes("network")
    );
  }
  return false;
}

function extractDomain(baseDN: string): string {
  return baseDN
    .split(",")
    .filter((part) => part.trim().toUpperCase().startsWith("DC="))
    .map((part) => part.split("=")[1])
    .join(".");
}
