import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  OnModuleDestroy,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { CACHE_STORE, CacheStore } from "./cache.constants";
import { CacheService } from "./cache.service";
import { MemoryCacheStore } from "./memory-cache.store";
import { RedisCacheStore } from "./redis-cache.store";

export const REDIS_CLIENT = Symbol("REDIS_CLIENT");

@Injectable()
class RedisShutdown implements OnModuleDestroy {
  constructor(
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis | null => {
        const logger = new Logger("CacheModule");
        const url = config.get<string>("redis.url") || "";
        if (!url) {
          logger.log("REDIS_URL not set; using in-memory cache");
          return null;
        }
        const redis = new Redis(url, {
          maxRetriesPerRequest: 2,
          enableReadyCheck: true,
        });
        redis.on("error", (err) => {
          logger.warn(`Redis error: ${err.message}`);
        });
        logger.log("Using Redis cache store");
        return redis;
      },
    },
    {
      provide: CACHE_STORE,
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis | null): CacheStore => {
        if (redis) return new RedisCacheStore(redis);
        return new MemoryCacheStore();
      },
    },
    RedisShutdown,
    CacheService,
  ],
  exports: [CacheService, REDIS_CLIENT],
})
export class CacheModule {}
