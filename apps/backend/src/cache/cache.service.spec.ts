import { CacheService } from "./cache.service";
import { CacheStore } from "./cache.constants";

describe("CacheService resilience", () => {
  it("returns factory value when store.set fails", async () => {
    const store: CacheStore = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockRejectedValue(new Error("redis down")),
      delete: jest.fn(),
      clear: jest.fn(),
    };
    const cache = new CacheService(store);
    const result = await cache.getOrSet("bot:metrics", async () => ({ n: 7 }), {
      ttlSeconds: 30,
      staleSeconds: 60,
    });
    expect(result.value).toEqual({ n: 7 });
    expect(result.cache).toBe("MISS");
  });

  it("treats store.get failure as miss", async () => {
    const store: CacheStore = {
      get: jest.fn().mockRejectedValue(new Error("redis down")),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
      clear: jest.fn(),
    };
    const cache = new CacheService(store);
    const result = await cache.getOrSet("k", async () => "ok", {
      ttlSeconds: 10,
    });
    expect(result.value).toBe("ok");
  });
});
