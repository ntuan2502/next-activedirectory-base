import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerTranslator } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userCount = await prisma.user.count();
    const settingsCount = await prisma.systemSetting.count();
    return NextResponse.json({
      success: true,
      isSetup: userCount > 0 && settingsCount > 0,
      adminExists: userCount > 0,
    });
  } catch (error: unknown) {
    const { t } = await getServerTranslator();
    const rawMessage = error instanceof Error ? error.message : t("common.unknownError");
    const message = t("errors.failedToQuerySetupStatus", { error: rawMessage });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
