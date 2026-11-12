import {
  Controller,
  Get,
  Param,
  UseGuards,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import { UsersService } from "./users.service";
import { AuthService } from "../auth/auth.service";
import { SessionGuard } from "../auth/guards/session.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { DiscordUser } from "../auth/discord-user.interface";

@Controller("users")
export class UsersController {
  constructor(
    private usersService: UsersService,
    private authService: AuthService,
  ) {}

  @Get("@me/guilds")
  @UseGuards(SessionGuard)
  async getMyGuilds(@Req() req: Request) {
    return this.authService.getAllUserGuildsWithBotStatus(req.accessToken!);
  }

  @Get("@me/discord-profile")
  @UseGuards(SessionGuard)
  async getMyDiscordProfile(@CurrentUser() user: DiscordUser) {
    return {
      id: user.id,
      username: user.username,
      global_name: user.global_name,
      avatar: user.avatar,
      banner: user.banner,
      accent_color: user.accent_color,
      avatar_decoration_data: user.avatar_decoration_data,
      collectibles: user.collectibles,
    };
  }

  @Get("@me/profile")
  @UseGuards(SessionGuard)
  async getMyProfile(@CurrentUser() user: DiscordUser) {
    return this.usersService.getProfile(user.id);
  }

  @Get("@me/settings")
  @UseGuards(SessionGuard)
  async getMySettings(@CurrentUser() user: DiscordUser) {
    return this.usersService.getSettings(user.id);
  }

  @Get("@me/rating")
  @UseGuards(SessionGuard)
  async getMyRating(@CurrentUser() user: DiscordUser) {
    return this.usersService.getSocialRating(user.id);
  }

  @Get("@me")
  @UseGuards(SessionGuard)
  async getMyFullProfile(@CurrentUser() user: DiscordUser) {
    return this.usersService.getFullProfile(user.id);
  }

  @Get(":id/profile")
  async getProfile(@Param("id") id: string) {
    return this.usersService.getProfile(id);
  }

  @Get(":id/settings")
  async getSettings(@Param("id") id: string) {
    return this.usersService.getSettings(id);
  }

  @Get(":id/rating")
  async getRating(@Param("id") id: string) {
    return this.usersService.getSocialRating(id);
  }

  @Get(":id")
  async getFullProfile(@Param("id") id: string) {
    return this.usersService.getFullProfile(id);
  }
}
