import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import {
  CACHE_STORE,
  CacheStats,
  CacheStore,
} from "./cache.constants";

export interface GetOrSetOptions {
  ttlSeconds: number;
  staleSeconds?: number;
  staleIfError?: boolean;
}

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly stats: CacheStats = { hits: 0, misses: 0, staleHits: 0 };

  constructor(@Inject(CACHE_STORE) private readonly store: CacheStore) {}

  getStats(): CacheStats {
    return { ...this.stats };
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = await this.safeGet<T>(key);
    if (!entry) {
      this.stats.misses += 1;
      return null;
    }
    if (Date.now() <= entry.expiresAt) {
      this.stats.hits += 1;
      return entry.value;
    }
    this.stats.staleHits += 1;
    return entry.value;
  }

  async set<T>(
    key: string,
    value: T,
    ttlSeconds: number,
    staleSeconds = 0,
  ): Promise<void> {
    await this.safeSet(key, value, ttlSeconds, staleSeconds);
  }

  async delete(key: string): Promise<void> {
    try {
      await this.store.delete(key);
    } catch (err) {
      this.logger.warn(
        `Cache delete failed for ${key}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async clear(): Promise<void> {
    try {
      await this.store.clear();
    } catch (err) {
      this.logger.warn(
        `Cache clear failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: GetOrSetOptions,
  ): Promise<{ value: T; cache: "HIT" | "MISS" | "STALE" }> {
    const entry = await this.safeGet<T>(key);
    const now = Date.now();

    if (entry && now <= entry.expiresAt) {
      this.stats.hits += 1;
      return { value: entry.value, cache: "HIT" };
    }

    if (entry && now <= entry.staleExpiresAt) {
      this.stats.staleHits += 1;
      // Refresh in background via single-flight without blocking
      void this.singleFlight(key, async () => {
        try {
          const fresh = await factory();
          await this.safeSet(
            key,
            fresh,
            options.ttlSeconds,
            options.staleSeconds ?? 0,
          );
          return fresh;
        } catch (err) {
          this.logger.warn(
            `Background cache refresh failed for ${key}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          return entry.value;
        }
      });
      return { value: entry.value, cache: "STALE" };
    }

    this.stats.misses += 1;

    try {
      const value = await this.singleFlight(key, factory);
      // Never fail the caller because the cache backend is down.
      await this.safeSet(
        key,
        value,
        options.ttlSeconds,
        options.staleSeconds ?? 0,
      );
      return { value, cache: "MISS" };
    } catch (err) {
      if (options.staleIfError && entry) {
        this.stats.staleHits += 1;
        return { value: entry.value, cache: "STALE" };
      }
      throw err;
    }
  }

  private async safeGet<T>(key: string) {
    try {
      return await this.store.get<T>(key);
    } catch (err) {
      this.logger.warn(
        `Cache get failed for ${key}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  private async safeSet<T>(
    key: string,
    value: T,
    ttlSeconds: number,
    staleSeconds = 0,
  ): Promise<void> {
    try {
      const jitteredTtl = this.withJitter(ttlSeconds);
      await this.store.set(key, value, jitteredTtl, staleSeconds);
    } catch (err) {
      this.logger.warn(
        `Cache set failed for ${key}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async singleFlight<T>(
    key: string,
    factory: () => Promise<T>,
  ): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = factory().finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, promise);
    return promise;
  }

  private withJitter(ttlSeconds: number): number {
    if (ttlSeconds <= 1) return ttlSeconds;
    const jitter = Math.floor(
      Math.random() * Math.max(1, Math.floor(ttlSeconds * 0.1)),
    );
    return ttlSeconds + jitter;
  }

  async onModuleDestroy() {
    // Redis client closed by module provider if present
  }
}
