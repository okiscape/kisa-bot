import Redis from "ioredis";
import { CacheEntry, CacheStore } from "./cache.constants";

interface RedisPayload<T> {
  value: T;
  expiresAt: number;
  staleExpiresAt: number;
}

export class RedisCacheStore implements CacheStore {
  constructor(private readonly redis: Redis) {}

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as RedisPayload<T>;
      if (Date.now() > parsed.staleExpiresAt) {
        await this.redis.del(key);
        return null;
      }
      return {
        value: parsed.value,
        expiresAt: parsed.expiresAt,
        staleExpiresAt: parsed.staleExpiresAt,
      };
    } catch {
      await this.redis.del(key);
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    ttlSeconds: number,
    staleSeconds = 0,
  ): Promise<void> {
    const now = Date.now();
    const payload: RedisPayload<T> = {
      value,
      expiresAt: now + ttlSeconds * 1000,
      staleExpiresAt: now + (ttlSeconds + staleSeconds) * 1000,
    };
    const redisTtl = Math.max(ttlSeconds + staleSeconds, ttlSeconds) + 1;
    await this.redis.set(key, JSON.stringify(payload), "EX", redisTtl);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async clear(): Promise<void> {
    await this.redis.flushdb();
  }
}
