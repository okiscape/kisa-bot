import {
  BadRequestException,
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { GuildsService } from "./guilds.service";
import { GuildAdminGuard } from "../auth/guards/guild-admin.guard";
import { SessionGuard } from "../auth/guards/session.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { DiscordUser } from "../auth/discord-user.interface";
import { ErrorCodes } from "../common/types/error-codes";
import { UpdateGuildSettingsDto } from "./dto/update-guild-settings.dto";

@ApiTags("guilds")
@ApiCookieAuth()
@Controller("guilds")
export class GuildsController {
  constructor(private readonly guildsService: GuildsService) {}

  @Get()
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: "List guilds the user can manage (or all)" })
  async listGuilds(
    @Req() req: Request,
    @CurrentUser() user: DiscordUser,
    @Query("filter") filter?: string,
  ) {
    const normalized =
      filter === "all" || filter === "manageable" ? filter : "manageable";
    return this.guildsService.listGuilds(
      req.accessToken!,
      user.id,
      normalized,
    );
  }

  @Get(":guildId")
  @UseGuards(GuildAdminGuard)
  @ApiOperation({ summary: "Guild detail + bot install status" })
  async getGuild(
    @Param("guildId") guildId: string,
    @Req() req: Request,
    @CurrentUser() user: DiscordUser,
  ) {
    const detail = await this.guildsService.getGuildDetail(
      req.accessToken!,
      user.id,
      guildId,
    );
    if (!detail) {
      throw new ForbiddenException({
        code: ErrorCodes.FORBIDDEN,
        message: "You don't have permission to manage this guild",
      });
    }
    return detail;
  }

  @Get(":guildId/roles")
  @UseGuards(GuildAdminGuard)
  @ApiOperation({ summary: "Guild roles (bot token, cached)" })
  async getRoles(@Param("guildId") guildId: string) {
    return this.guildsService.getRoles(guildId);
  }

  @Get(":guildId/channels")
  @UseGuards(GuildAdminGuard)
  @ApiOperation({ summary: "Guild channels for settings selects (cached)" })
  async getChannels(@Param("guildId") guildId: string) {
    return this.guildsService.getChannels(guildId);
  }

  @Get(":guildId/settings")
  @UseGuards(GuildAdminGuard)
  @ApiOperation({ summary: "Guild settings merged with defaults" })
  async getSettings(@Param("guildId") guildId: string) {
    return this.guildsService.getSettings(guildId);
  }

  @Get(":guildId/settings/options")
  @UseGuards(GuildAdminGuard)
  @ApiOperation({ summary: "Channels, roles, and enum options for settings UI" })
  async getSettingsOptions(@Param("guildId") guildId: string) {
    return this.guildsService.getSettingsOptions(guildId);
  }

  @Get(":guildId/webhooks/preview")
  @UseGuards(GuildAdminGuard)
  @ApiOperation({ summary: "Resolve Discord webhook name and avatar for preview" })
  async previewWebhook(
    @Param("guildId") guildId: string,
    @Query("url") url?: string,
  ) {
    if (!url?.trim()) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_ERROR,
        message: "Webhook URL is required",
      });
    }
    return this.guildsService.previewWebhook(guildId, url);
  }

  @Patch(":guildId/settings")
  @UseGuards(GuildAdminGuard)
  @ApiOperation({ summary: "Partial update guild settings" })
  async patchSettings(
    @Param("guildId") guildId: string,
    @Body() body: UpdateGuildSettingsDto,
  ) {
    return this.guildsService.updateSettings(guildId, body);
  }

  @Delete(":guildId/settings")
  @UseGuards(GuildAdminGuard)
  @ApiOperation({ summary: "Reset guild settings to defaults" })
  async deleteSettings(@Param("guildId") guildId: string) {
    return this.guildsService.deleteSettings(guildId);
  }
}
