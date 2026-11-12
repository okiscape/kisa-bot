import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "../auth.service";
import { SessionService } from "../session.service";
import { ErrorCodes } from "../../common/types/error-codes";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const cookieName = this.sessions.getCookieName();
    const sessionId = request.cookies?.[cookieName] as string | undefined;

    try {
      const active = await this.sessions.resolveActiveSession(sessionId);
      const { accessToken, user } = await this.auth.ensureFreshAccessToken(active);

      request.discordUser = user;
      request.sessionId = active.session.id;
      request.accessToken = accessToken;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException({
        code: ErrorCodes.UNAUTHENTICATED,
        message: "Not authenticated",
      });
    }
  }
}

/** @deprecated Prefer SessionGuard — kept as alias during migration */
export { SessionGuard as DiscordGuard };
