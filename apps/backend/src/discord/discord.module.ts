import { Global, Module } from "@nestjs/common";
import { BotController } from "./bot.controller";
import { BotService } from "./bot.service";
import { DiscordApiClient } from "./discord-api.client";

@Global()
@Module({
  controllers: [BotController],
  providers: [DiscordApiClient, BotService],
  exports: [DiscordApiClient, BotService],
})
export class DiscordModule {}
