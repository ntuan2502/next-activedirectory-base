import { Client } from "ldapts";

const LDAP_DEFAULTS = {
  port: "389",
  baseDN: "DC=example,DC=com",
  filter: "(&(objectCategory=person)(objectClass=user))",
};

type LdapConfig = {
  url: string;
  port: string;
  username: string;
  password: string;
  baseDN: string;
  filter: string;
};

export function getLdapConfig(): LdapConfig {
  const url = process.env.LDAP_URL;
  const username = process.env.LDAP_USERNAME;
  const password = process.env.LDAP_PASSWORD;

  if (!url || !username || !password) {
    throw new Error("Missing required LDAP configuration (LDAP_URL, LDAP_USERNAME, LDAP_PASSWORD).");
  }

  return {
    url,
    port: process.env.LDAP_PORT || LDAP_DEFAULTS.port,
    username,
    password,
    baseDN: process.env.LDAP_BASE_DN || LDAP_DEFAULTS.baseDN,
    filter: process.env.LDAP_FILTER || LDAP_DEFAULTS.filter,
  };
}

export function createLdapClient(config: LdapConfig): Client {
  const fullUrl = `${config.url}:${config.port}`;
  return new Client({ url: fullUrl });
}

export async function withLdapClient<T>(
  fn: (client: Client, config: LdapConfig) => Promise<T>
): Promise<T> {
  const config = getLdapConfig();
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
  "employeeID",
  "manager",
  "mobile",
  "displayName",
];
