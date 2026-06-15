import { NextRequest, NextResponse } from "next/server";
import { getLdapConfig, createLdapClient } from "@/lib/ldap";
import { logAction } from "@/lib/audit";
import { getServerTranslator } from "@/lib/i18n";

export async function POST(request: NextRequest) {
  const { t } = await getServerTranslator();

  let config = {
    url: "",
    port: "",
    username: "",
    password: "",
    baseDN: "",
    filter: "",
  };

  const dbConfig = await getLdapConfig().catch(() => null);

  try {
    const body = await request.json();
    if (body && typeof body === "object") {
      config = {
        url: body.ldapUrl !== undefined ? body.ldapUrl : (dbConfig?.url || ""),
        port: body.ldapPort !== undefined ? String(body.ldapPort) : (dbConfig?.port || ""),
        username: body.ldapBindDn !== undefined ? body.ldapBindDn : (dbConfig?.username || ""),
        password: body.ldapBindPassword ? body.ldapBindPassword : (dbConfig?.password || ""),
        baseDN: body.ldapBaseDn !== undefined ? body.ldapBaseDn : (dbConfig?.baseDN || ""),
        filter: body.ldapFilter !== undefined ? body.ldapFilter : (dbConfig?.filter || ""),
      };
    }
  } catch {
    if (dbConfig) {
      config = {
        url: dbConfig.url,
        port: dbConfig.port,
        username: dbConfig.username,
        password: dbConfig.password,
        baseDN: dbConfig.baseDN,
        filter: dbConfig.filter,
      };
    }
  }

  const configDetails = {
    url: config.url,
    port: config.port,
    username: config.username,
    baseDN: config.baseDN,
    filter: config.filter,
  };

  try {
    const client = createLdapClient(config);
    await client.bind(config.username, config.password);
    await client.unbind();

    await logAction("ldap:test_connection", "success", {
      success: true,
      message: "setupPage.successTest",
      config: configDetails,
    });
    return NextResponse.json({ success: true, message: t("setupPage.successTest") });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("setupPage.errorLdapTest", { error: rawMessage });
    console.error(error);
    await logAction("ldap:test_connection", "failed", {
      success: false,
      error: "setupPage.errorLdapTest",
      errorDetails: rawMessage,
      config: configDetails,
    });
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
