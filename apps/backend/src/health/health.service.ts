import { Inject, Injectable, Optional } from "@nestjs/common";
import Redis from "ioredis";
import { PrismaService } from "../prisma/prisma.service";
import { REDIS_CLIENT } from "../cache/cache.module";
import { CacheService } from "../cache/cache.service";

export interface HealthCheckResult {
  status: "ok" | "degraded" | "error";
  checks: {
    database: { status: "up" | "down"; latencyMs?: number };
    redis: { status: "up" | "down" | "disabled"; latencyMs?: number };
  };
  cache?: ReturnType<CacheService["getStats"]>;
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  live() {
    return {
      status: "ok" as const,
      timestamp: new Date().toISOString(),
    };
  }

  async ready(): Promise<HealthCheckResult> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const status =
      database.status === "down"
        ? "error"
        : redis.status === "down"
          ? "degraded"
          : "ok";

    return {
      status,
      checks: { database, redis },
      cache: this.cache.getStats(),
      timestamp: new Date().toISOString(),
    };
  }

  async summary(): Promise<HealthCheckResult> {
    return this.ready();
  }

  private async checkDatabase(): Promise<{
    status: "up" | "down";
    latencyMs?: number;
  }> {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "up", latencyMs: Date.now() - started };
    } catch {
      return { status: "down", latencyMs: Date.now() - started };
    }
  }

  private async checkRedis(): Promise<{
    status: "up" | "down" | "disabled";
    latencyMs?: number;
  }> {
    if (!this.redis) {
      return { status: "disabled" };
    }
    const started = Date.now();
    try {
      const pong = await this.redis.ping();
      if (pong !== "PONG") {
        return { status: "down", latencyMs: Date.now() - started };
      }
      return { status: "up", latencyMs: Date.now() - started };
    } catch {
      return { status: "down", latencyMs: Date.now() - started };
    }
  }
}
