import { Injectable } from "@nestjs/common";
import { CacheService } from "../cache/cache.service";
import { avatarUrl } from "./discord-cdn.util";
import { DiscordApiClient } from "./discord-api.client";

export type BotPublicProfile = {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  avatarUrl: string;
};

@Injectable()
export class BotService {
  constructor(
    private readonly discord: DiscordApiClient,
    private readonly cache: CacheService,
  ) {}

  async getPublicProfile(): Promise<BotPublicProfile> {
    const { value } = await this.cache.getOrSet(
      "bot:public-profile",
      () => this.fetchProfile(),
      { ttlSeconds: 300, staleSeconds: 3600, staleIfError: true },
    );

    if (!value) {
      throw new Error("Bot profile unavailable");
    }
    return value;
  }

  private async fetchProfile(): Promise<BotPublicProfile> {
    const user = await this.discord.getBotUser();
    return {
      id: user.id,
      username: user.username,
      globalName: user.global_name,
      avatar: user.avatar,
      avatarUrl: avatarUrl(user.id, user.avatar, 128),
    };
  }
}
