import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { IntegrationsController } from "./integrations.controller";
import { IntegrationsService } from "./integrations.service";
import { OsuApiClient } from "./osu-api.client";
import { LastfmApiClient } from "./lastfm-api.client";

@Module({
  imports: [AuthModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, OsuApiClient, LastfmApiClient],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
