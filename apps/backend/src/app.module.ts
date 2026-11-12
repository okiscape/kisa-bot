import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import configuration from "./config/configuration";
import { validateEnv } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { CacheModule } from "./cache/cache.module";
import { AuthModule } from "./auth/auth.module";
import { GuildsModule } from "./guilds/guilds.module";
import { UsersModule } from "./users/users.module";
import { HealthModule } from "./health/health.module";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { GlobalExceptionFilter } from "./common/filters/http-exception.filter";
import { BigIntInterceptor } from "./common/interceptors/bigint.interceptor";
import { ResponseEnvelopeInterceptor } from "./common/interceptors/response.interceptor";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
      load: [configuration],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    CacheModule,
    AuthModule,
    GuildsModule,
    UsersModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: BigIntInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseEnvelopeInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
