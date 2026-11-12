import { Global, Module } from "@nestjs/common";
import { DiscordApiClient } from "./discord-api.client";

@Global()
@Module({
  providers: [DiscordApiClient],
  exports: [DiscordApiClient],
})
export class DiscordModule {}
