import { Client } from "ldapts";


export type LdapConfig = {
  url: string;
  port: string;
  username: string;
  password: string;
  baseDN: string;
  filter: string;
};

export async function getLdapConfig(): Promise<LdapConfig> {
  const { prisma } = await import("@/lib/db");
  const settings = await prisma.systemSetting.findFirst();
  
  if (!settings || !settings.ldapUrl) {
    throw new Error("errors.ldapConfigMissing");
  }

  return {
    url: settings.ldapUrl ?? "",
    port: settings.ldapPort !== null && settings.ldapPort !== undefined ? String(settings.ldapPort) : "",
    username: settings.ldapBindDn ?? "",
    password: settings.ldapBindPassword ?? "",
    baseDN: settings.ldapBaseDn ?? "",
    filter: settings.ldapFilter ?? "",
  };
}

export function createLdapClient(config: LdapConfig): Client {
  const fullUrl = `${config.url}:${config.port}`;
  return new Client({ url: fullUrl });
}

export async function withLdapClient<T>(
  fn: (client: Client, config: LdapConfig) => Promise<T>
): Promise<T> {
  const config = await getLdapConfig();
  const client = createLdapClient(config);

  try {
    await client.bind(config.username, config.password);
    const result = await fn(client, config);
    await client.unbind();
    return result;
  } catch (error) {
    try { await client.unbind(); } catch {}
    throw error;
  }
}

export function getAttr(entry: Record<string, unknown>, attrName: string): string {
  const actualKey = Object.keys(entry).find(
    (k) => k.toLowerCase() === attrName.toLowerCase()
  );
  if (!actualKey) return "";

  const val = entry[actualKey];
  if (Array.isArray(val)) return String(val[0] ?? "");
  return String(val ?? "");
}

export const LDAP_USER_ATTRIBUTES = [
  "sAMAccountName",
  "userPrincipalName",
  "mail",
  "givenName",
  "sn",
  "cn",
  "title",
  "department",
  "company",
  "employeeID",
  "manager",
  "mobile",
  "displayName",
];
