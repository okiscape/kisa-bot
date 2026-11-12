import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { UsersService } from "./users.service";
import { AuthService } from "../auth/auth.service";
import { SessionGuard } from "../auth/guards/session.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { DiscordUser } from "../auth/discord-user.interface";
import { UpdateUserSettingsDto } from "./dto/update-user-settings.dto";
import { UpdateUserProfileDto } from "./dto/update-user-profile.dto";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Get("@me/guilds")
  @ApiCookieAuth()
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: "Manageable guilds + hasBot (compat)" })
  async getMyGuilds(@Req() req: Request, @CurrentUser() user: DiscordUser) {
    return this.authService.getAllUserGuildsWithBotStatus(
      req.accessToken!,
      user.id,
    );
  }

  @Get("@me/discord")
  @ApiCookieAuth()
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: "Full Discord profile for current user" })
  async getMyDiscord(@CurrentUser() user: DiscordUser) {
    return this.usersService.toDiscordProfile(user);
  }

  /** @deprecated Prefer GET /users/@me/discord */
  @Get("@me/discord-profile")
  @ApiCookieAuth()
  @UseGuards(SessionGuard)
  async getMyDiscordProfile(@CurrentUser() user: DiscordUser) {
    return this.usersService.toDiscordProfile(user);
  }

  @Get("@me/profile")
  @ApiCookieAuth()
  @UseGuards(SessionGuard)
  async getMyProfile(@CurrentUser() user: DiscordUser) {
    return this.usersService.getProfile(user.id);
  }

  @Patch("@me/profile")
  @ApiCookieAuth()
  @UseGuards(SessionGuard)
  async patchMyProfile(
    @CurrentUser() user: DiscordUser,
    @Body() body: UpdateUserProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, body);
  }

  @Delete("@me/profile")
  @ApiCookieAuth()
  @UseGuards(SessionGuard)
  async resetMyProfile(@CurrentUser() user: DiscordUser) {
    return this.usersService.resetProfile(user.id);
  }

  @Get("@me/settings")
  @ApiCookieAuth()
  @UseGuards(SessionGuard)
  async getMySettings(@CurrentUser() user: DiscordUser) {
    return this.usersService.getSettings(user.id);
  }

  @Patch("@me/settings")
  @ApiCookieAuth()
  @UseGuards(SessionGuard)
  async patchMySettings(
    @CurrentUser() user: DiscordUser,
    @Body() body: UpdateUserSettingsDto,
  ) {
    return this.usersService.updateSettings(user.id, body);
  }

  @Delete("@me/settings")
  @ApiCookieAuth()
  @UseGuards(SessionGuard)
  async resetMySettings(@CurrentUser() user: DiscordUser) {
    return this.usersService.resetSettings(user.id);
  }

  @Get("@me/rating")
  @ApiCookieAuth()
  @UseGuards(SessionGuard)
  async getMyRating(@CurrentUser() user: DiscordUser) {
    return { rating: await this.usersService.getSocialRating(user.id) };
  }

  @Get("@me")
  @ApiCookieAuth()
  @UseGuards(SessionGuard)
  async getMyFullProfile(@CurrentUser() user: DiscordUser) {
    return this.usersService.getFullProfile(user.id, user);
  }

  @Get(":userId/public")
  @ApiOperation({ summary: "Safe public profile fields only" })
  async getPublicProfile(@Param("userId") userId: string) {
    return this.usersService.getPublicProfile(userId);
  }
}
