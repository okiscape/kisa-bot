import {
  Controller,
  Get,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ErrorCodes } from "../common/types/error-codes";
import { BotService } from "./bot.service";

@ApiTags("bot")
@Controller("bot")
export class BotController {
  constructor(private readonly bot: BotService) {}

  @Get()
  @ApiOperation({ summary: "Public Discord bot identity (avatar, username)" })
  async getPublicProfile() {
    try {
      return await this.bot.getPublicProfile();
    } catch {
      throw new ServiceUnavailableException({
        code: ErrorCodes.DISCORD_UNAVAILABLE,
        message: "Bot profile unavailable",
      });
    }
  }
}
