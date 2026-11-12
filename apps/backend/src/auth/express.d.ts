import { DiscordUser } from "./discord-user.interface";

declare global {
  namespace Express {
    interface Request {
      discordUser?: DiscordUser;
      requestId?: string;
    }
  }
}

export {};
