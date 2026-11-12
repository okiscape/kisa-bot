import { CacheEntry, CacheStore } from "./cache.constants";

export class MemoryCacheStore implements CacheStore {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.staleExpiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry as CacheEntry<T>;
  }

  async set<T>(
    key: string,
    value: T,
    ttlSeconds: number,
    staleSeconds = 0,
  ): Promise<void> {
    const now = Date.now();
    this.store.set(key, {
      value,
      expiresAt: now + ttlSeconds * 1000,
      staleExpiresAt: now + (ttlSeconds + staleSeconds) * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
