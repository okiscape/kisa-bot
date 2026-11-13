import { MetricsService } from "./metrics.service";

describe("MetricsService", () => {
  const staleAfterSeconds = 120;

  function makeService(row: Record<string, unknown> | null) {
    const prisma = {
      botMetrics: {
        findUnique: jest.fn().mockResolvedValue(row),
      },
    };
    const cache = {
      getOrSet: jest.fn(async (_k: string, factory: () => Promise<unknown>) => ({
        value: await factory(),
        cache: "MISS" as const,
      })),
    };
    const config = {
      get: (key: string) =>
        key === "metrics.staleAfterSeconds" ? staleAfterSeconds : undefined,
    };
    return new MetricsService(prisma as never, cache as never, config as never);
  }

  it("returns zeros when row missing", async () => {
    const service = makeService(null);
    const { data } = await service.getSummary();
    expect(data.online).toBe(false);
    expect(data.guildCount).toBe(0);
    expect(data.stale).toBe(true);
  });

  it("marks stale when updatedAt is old", async () => {
    const service = makeService({
      online: true,
      guildCount: 10,
      userCount: 100,
      commandCount: 5,
      usedCommands: 42,
      channelCount: 20,
      shardCount: 1,
      uptimeSeconds: 60,
      latencyMs: 40,
      version: "kisa-0.1",
      updatedAt: new Date(Date.now() - 10 * 60_000),
    });
    const { data } = await service.getDetailed();
    expect(data.guildCount).toBe(10);
    expect(data.online).toBe(false);
    expect(data.stale).toBe(true);
    expect(data.channelCount).toBe(20);
  });

  it("reports online when fresh", async () => {
    const service = makeService({
      online: true,
      guildCount: 3,
      userCount: 9,
      commandCount: 2,
      usedCommands: 17,
      channelCount: 4,
      shardCount: 1,
      uptimeSeconds: 10,
      latencyMs: 12,
      version: "kisa-0.1",
      updatedAt: new Date(),
    });
    const { data } = await service.getSummary();
    expect(data.online).toBe(true);
    expect(data.stale).toBe(false);
    expect(data.guildCount).toBe(3);
    expect(data.usedCommands).toBe(17);
  });
});
