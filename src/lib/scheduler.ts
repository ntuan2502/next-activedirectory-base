import { prisma } from "@/lib/db";
import { syncLdapUsers, logLdapSyncResult } from "@/modules/ldap/services";
import { logger } from "@/lib/logger";

declare global {
  var __schedulerInterval__: NodeJS.Timeout | undefined;
  var __schedulerRunning__: boolean | undefined;
}

export function startScheduler() {
  if (globalThis.__schedulerInterval__) {
    logger.info("logs.schedulerAlreadyActive");
    return;
  }

  logger.info("logs.schedulerInitializing");

  setTimeout(checkAndRunSync, 15000);

  const interval = setInterval(checkAndRunSync, 60000);
  globalThis.__schedulerInterval__ = interval;
}

export async function checkAndRunSync() {
  if (globalThis.__schedulerRunning__) {
    logger.info("logs.schedulerSyncRunning");
    return;
  }

  try {
    const settings = await prisma.systemSetting.findFirst();

    if (!settings || !settings.syncEnabled) {
      return;
    }

    const now = new Date();
    const intervalMinutes = Math.max(1, settings.syncInterval || 1440);
    const lastSync = settings.lastSyncAt ? new Date(settings.lastSyncAt) : new Date(0);

    const timeDiff = now.getTime() - lastSync.getTime();
    const intervalMs = intervalMinutes * 60 * 1000;

    if (timeDiff >= intervalMs) {
      logger.info("logs.schedulerSyncStarting", {
        intervalMinutes,
        lastSync: lastSync.toISOString(),
      });
      globalThis.__schedulerRunning__ = true;

      try {
        const result = await syncLdapUsers();

        await prisma.systemSetting.update({
          where: { id: settings.id },
          data: {
            lastSyncAt: now,
            lastSyncStatus: "success",
            lastSyncMessage: `Successfully synchronized ${result.syncedCount} users (Created: ${result.usersCreated.length}, Updated: ${result.usersUpdated.length})`,
          },
        });

        await logLdapSyncResult(result);

        logger.info("logs.schedulerSyncSuccess", { syncedCount: result.syncedCount });
      } catch (syncError: unknown) {
        const errorMsg = syncError instanceof Error ? syncError.message : "Unknown LDAP sync error";
        logger.error("logs.schedulerSyncError", syncError);

        await prisma.systemSetting.update({
          where: { id: settings.id },
          data: {
            lastSyncAt: now,
            lastSyncStatus: "failed",
            lastSyncMessage: errorMsg,
          },
        });

        await logLdapSyncResult(null, {
          key: "errors.failedToSyncLdap",
          params: { error: errorMsg },
        });
      } finally {
        globalThis.__schedulerRunning__ = false;
      }
    }
  } catch (dbError) {
    logger.error("logs.schedulerDbError", dbError);
  }
}
