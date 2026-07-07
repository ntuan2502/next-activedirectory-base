import { prisma } from "@/lib/db";
import { syncLdapUsers, logLdapSyncResult } from "@/modules/ldap/services";

declare global {
  var __schedulerInterval__: NodeJS.Timeout | undefined;
  var __schedulerRunning__: boolean | undefined;
}

export function startScheduler() {
  // Prevent duplicate schedulers in development (Next.js hot reloads)
  if (globalThis.__schedulerInterval__) {
    console.log("[Scheduler] Already active, skipping initialization.");
    return;
  }

  console.log("[Scheduler] Initializing background LDAP sync scheduler...");

  // Run initial check after 15 seconds
  setTimeout(checkAndRunSync, 15000);

  // Check every 1 minute (60000 ms)
  const interval = setInterval(checkAndRunSync, 60000);
  globalThis.__schedulerInterval__ = interval;
}

export async function checkAndRunSync() {
  if (globalThis.__schedulerRunning__) {
    console.log("[Scheduler] Sync is already running in background, skipping check.");
    return;
  }

  try {
    const settings = await prisma.systemSetting.findFirst();

    if (!settings || !settings.syncEnabled) {
      return;
    }

    const now = new Date();
    // Default interval to 24 hours if null/0/negative
    const intervalMinutes = Math.max(1, settings.syncInterval || 1440);
    const lastSync = settings.lastSyncAt ? new Date(settings.lastSyncAt) : new Date(0);

    const timeDiff = now.getTime() - lastSync.getTime();
    const intervalMs = intervalMinutes * 60 * 1000;

    if (timeDiff >= intervalMs) {
      console.log(`[Scheduler] Starting scheduled sync (interval: ${intervalMinutes}m, last sync: ${lastSync.toISOString()})...`);
      globalThis.__schedulerRunning__ = true;

      try {
        // Run full sync (passing undefined matches all users)
        const result = await syncLdapUsers();

        await prisma.systemSetting.update({
          where: { id: settings.id },
          data: {
            lastSyncAt: now,
            lastSyncStatus: "success",
            lastSyncMessage: `Successfully synchronized ${result.syncedCount} users (Created: ${result.usersCreated.length}, Updated: ${result.usersUpdated.length})`,
          },
        });

        // Ghi audit log cho đồng bộ tự động thành công
        await logLdapSyncResult(result);

        console.log(`[Scheduler] Sync successful: ${result.syncedCount} users.`);
      } catch (syncError: unknown) {
        const errorMsg = syncError instanceof Error ? syncError.message : "Unknown LDAP sync error";
        console.error(syncError);

        await prisma.systemSetting.update({
          where: { id: settings.id },
          data: {
            lastSyncAt: now,
            lastSyncStatus: "failed",
            lastSyncMessage: errorMsg,
          },
        });

        // Ghi audit log cho đồng bộ tự động thất bại
        await logLdapSyncResult(null, {
          key: "errors.failedToSyncLdap",
          params: { error: errorMsg },
        });
      } finally {
        globalThis.__schedulerRunning__ = false;
      }
    }
  } catch (dbError) {
    console.error(dbError);
  }
}
