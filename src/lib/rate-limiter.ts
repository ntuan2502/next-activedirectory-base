export class InMemoryRateLimiter {
  private cache = new Map<string, { count: number; resetTime: number }>();

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  public isRateLimited(key: string): boolean {
    const now = Date.now();
    const client = this.cache.get(key);

    if (!client || now > client.resetTime) {
      this.cache.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return false;
    }

    if (client.count >= this.maxRequests) {
      return true;
    }

    client.count++;
    return false;
  }
}

// Ldap Sync: Tối đa 3 lần / phút
export const ldapSyncLimiter = new InMemoryRateLimiter(3, 60 * 1000);

// Reset mật khẩu: Tối đa 5 lần / phút
export const passwordResetLimiter = new InMemoryRateLimiter(5, 60 * 1000);
