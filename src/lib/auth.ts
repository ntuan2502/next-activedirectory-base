import { Client } from "ldapts";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getLdapConfig, createLdapClient, type LdapConfig } from "@/lib/ldap";
import { getServerTranslator } from "@/lib/i18n";

type AuthResult = {
  userId: string;
  username: string;
  displayName: string;
};

export class AuthError extends Error {
  constructor(key: string) {
    super(key);
    this.name = "AuthError";
  }
}

export async function authenticateUser(
  username: string,
  password: string,
): Promise<AuthResult> {
  const dbUser = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
  });

  if (dbUser?.disabled) {
    throw new AuthError("errors.accountDisabled");
  }

  // If local user (no DN in AD/LDAP), bypass LDAP entirely and authenticate locally
  if (dbUser && dbUser.dn === "") {
    return authenticateViaCachedPassword(username, password);
  }

  const config = await getLdapConfig();

  // Step 1: Try LDAP authentication
  try {
    const result = await authenticateViaLdap(username, password, config);
    return result;
  } catch (ldapError: unknown) {
    const isConnectionError = isLdapConnectionError(ldapError);

    if (!isConnectionError) {
      // LDAP responded but credentials are invalid
      throw new AuthError("loginPage.invalidCredentials");
    }

    // Step 2: LDAP unreachable — fallback to cached password
    try {
      const { t } = await getServerTranslator();
      console.warn(t("logs.ldapFallbackToCache"));
    } catch {
      console.warn("LDAP server is unreachable, falling back to cached credentials.");
    }
    return authenticateViaCachedPassword(username, password);
  }
}

async function authenticateViaLdap(
  username: string,
  password: string,
  config: LdapConfig,
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

  const user = await prisma.user.upsert({
    where: { username: username.toLowerCase() },
    update: {
      passwordHash,
      lastLoginAt: new Date(),
    },
    create: {
      username: username.toLowerCase(),
      passwordHash,
      lastLoginAt: new Date(),
    },
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
    throw new AuthError("errors.ldapUnreachable");
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new AuthError("loginPage.invalidCredentials");
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
