import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "../auth.service";
import { SessionService } from "../session.service";
import { ErrorCodes } from "../../common/types/error-codes";

@Injectable()
export class GuildAdminGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const cookieName = this.sessions.getCookieName();
    const sessionId = request.cookies?.[cookieName] as string | undefined;

    let accessToken: string;
    try {
      const active = await this.sessions.resolveActiveSession(sessionId);
      const fresh = await this.auth.ensureFreshAccessToken(active);
      accessToken = fresh.accessToken;
      request.discordUser = fresh.user;
      request.sessionId = active.session.id;
      request.accessToken = accessToken;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException({
        code: ErrorCodes.UNAUTHENTICATED,
        message: "Not authenticated",
      });
    }

    const rawGuildId = request.params.guildId ?? request.params.id;
    const guildId = (
      Array.isArray(rawGuildId) ? rawGuildId[0] : rawGuildId
    ) as string | undefined;
    if (!guildId) {
      throw new ForbiddenException({
        code: ErrorCodes.FORBIDDEN,
        message: "Guild ID is required",
      });
    }

    const hasAccess = await this.auth.checkUserGuildAccess(
      accessToken,
      guildId,
    );
    if (!hasAccess) {
      throw new ForbiddenException({
        code: ErrorCodes.FORBIDDEN,
        message: "You don't have permission to manage this guild",
      });
    }

    return true;
  }
}
