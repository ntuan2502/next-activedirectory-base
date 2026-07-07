import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin: Record<string, string> = {};
  if (process.env.DEMO_ADMIN_USERNAME) admin.username = process.env.DEMO_ADMIN_USERNAME;
  if (process.env.DEMO_ADMIN_DISPLAY_NAME) admin.displayName = process.env.DEMO_ADMIN_DISPLAY_NAME;
  if (process.env.DEMO_ADMIN_EMAIL) admin.email = process.env.DEMO_ADMIN_EMAIL;
  if (process.env.DEMO_ADMIN_PASSWORD) admin.password = process.env.DEMO_ADMIN_PASSWORD;

  const ldap: Record<string, string> = {};
  if (process.env.DEMO_LDAP_URL) ldap.ldapUrl = process.env.DEMO_LDAP_URL;
  if (process.env.DEMO_LDAP_PORT) ldap.ldapPort = process.env.DEMO_LDAP_PORT;
  if (process.env.DEMO_LDAP_BIND_DN) ldap.ldapBindDn = process.env.DEMO_LDAP_BIND_DN;
  if (process.env.DEMO_LDAP_BIND_PASSWORD) ldap.ldapBindPassword = process.env.DEMO_LDAP_BIND_PASSWORD;
  if (process.env.DEMO_LDAP_BASE_DN) ldap.ldapBaseDn = process.env.DEMO_LDAP_BASE_DN;
  if (process.env.DEMO_LDAP_FILTER) ldap.ldapFilter = process.env.DEMO_LDAP_FILTER;

  const hasAdminDemo = Object.keys(admin).length > 0;
  const hasLdapDemo = Object.keys(ldap).length > 0;

  return NextResponse.json({
    success: true,
    hasAdminDemo,
    hasLdapDemo,
    admin,
    ldap,
  });
}
