export const CACHE_STORE = Symbol("CACHE_STORE");

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  staleExpiresAt: number;
}

export interface CacheStore {
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  set<T>(
    key: string,
    value: T,
    ttlSeconds: number,
    staleSeconds?: number,
  ): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface CacheStats {
  hits: number;
  misses: number;
  staleHits: number;
}
