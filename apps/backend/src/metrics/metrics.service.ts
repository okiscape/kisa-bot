import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../cache/cache.service";

export interface MetricsSummary {
  online: boolean;
  guildCount: number;
  userCount: number;
  commandCount: number;
  usedCommands: number;
  uptimeSeconds: number;
  latencyMs: number;
  version: string;
  updatedAt: string | null;
  fetchedAt: string;
  stale: boolean;
}

export interface MetricsDetailed extends MetricsSummary {
  channelCount: number;
  shardCount: number;
}

const EMPTY: Omit<MetricsDetailed, "fetchedAt" | "stale"> = {
  online: false,
  guildCount: 0,
  userCount: 0,
  commandCount: 0,
  usedCommands: 0,
  channelCount: 0,
  shardCount: 0,
  uptimeSeconds: 0,
  latencyMs: 0,
  version: "",
  updatedAt: null,
};

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {}

  private staleAfterMs(): number {
    const seconds =
      this.config.get<number>("metrics.staleAfterSeconds") ?? 120;
    return seconds * 1000;
  }

  async getSummary(): Promise<{
    data: MetricsSummary;
    cache: "HIT" | "MISS" | "STALE";
  }> {
    const detailed = await this.getDetailed();
    const { channelCount: _c, shardCount: _s, ...summary } = detailed.data;
    return { data: summary, cache: detailed.cache };
  }

  async getDetailed(): Promise<{
    data: MetricsDetailed;
    cache: "HIT" | "MISS" | "STALE";
  }> {
    const fetchedAt = new Date().toISOString();
    try {
      const { value, cache } = await this.cache.getOrSet(
        "bot:metrics",
        () => this.readRow(),
        { ttlSeconds: 30, staleSeconds: 300, staleIfError: true },
      );

      if (!value) {
        return {
          data: { ...EMPTY, fetchedAt, stale: true },
          cache,
        };
      }

      const updatedAtMs = value.updatedAt
        ? new Date(value.updatedAt).getTime()
        : 0;
      const ageStale = Date.now() - updatedAtMs > this.staleAfterMs();
      const stale = ageStale || cache === "STALE";

      return {
        data: {
          ...value,
          online: Boolean(value.online) && !ageStale,
          stale,
          fetchedAt,
        },
        cache,
      };
    } catch (err) {
      this.logger.warn(
        `Metrics read failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      // Last resort: bypass cache and hit Postgres directly.
      try {
        const row = await this.readRow();
        if (row) {
          const updatedAtMs = row.updatedAt
            ? new Date(row.updatedAt).getTime()
            : 0;
          const ageStale = Date.now() - updatedAtMs > this.staleAfterMs();
          return {
            data: {
              ...row,
              online: Boolean(row.online) && !ageStale,
              stale: ageStale,
              fetchedAt,
            },
            cache: "STALE",
          };
        }
      } catch (inner) {
        this.logger.warn(
          `Metrics DB fallback failed: ${
            inner instanceof Error ? inner.message : String(inner)
          }`,
        );
      }
      return {
        data: { ...EMPTY, fetchedAt, stale: true },
        cache: "STALE",
      };
    }
  }

  private async readRow(): Promise<Omit<
    MetricsDetailed,
    "fetchedAt" | "stale"
  > | null> {
    const row = await this.prisma.botMetrics.findUnique({ where: { id: 1 } });
    if (!row) return null;
    return {
      online: row.online,
      guildCount: row.guildCount,
      userCount: row.userCount,
      commandCount: row.commandCount,
      usedCommands: row.usedCommands,
      channelCount: row.channelCount,
      shardCount: row.shardCount,
      uptimeSeconds: row.uptimeSeconds,
      latencyMs: row.latencyMs,
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
