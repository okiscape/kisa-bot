import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { OauthStateService } from "./oauth-state.service";
import { SessionService } from "./session.service";
import { SessionGuard } from "./guards/session.guard";
import { CsrfGuard } from "./guards/csrf.guard";
import { CurrentUser } from "./current-user.decorator";
import { DiscordUser } from "./discord-user.interface";
import { SkipEnvelope } from "../common/decorators/skip-envelope.decorator";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessions: SessionService,
    private readonly oauthState: OauthStateService,
    private readonly config: ConfigService,
  ) {}

  @Get("discord/login")
  @SkipEnvelope()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: "Start Discord OAuth2 login" })
  login(@Res() res: Response) {
    const clientId = this.config.getOrThrow<string>("discord.clientId");
    const redirectUri = this.config.getOrThrow<string>("discord.redirectUri");
    const state = this.oauthState.createState();
    this.oauthState.setCookie(res, state);

    const url = new URL("https://discord.com/api/oauth2/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "identify guilds");
    url.searchParams.set("state", state);
    return res.redirect(url.toString());
  }

  @Get("discord/callback")
  @SkipEnvelope()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Discord OAuth2 callback" })
  async callback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") oauthError: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.getOrThrow<string>("frontendUrl");
    const stateCookie = req.cookies?.[this.oauthState.cookieName()] as
      | string
      | undefined;

    const fail = (reason: string) => {
      this.oauthState.clearCookie(res);
      return res.redirect(
        `${frontendUrl}/login?error=${encodeURIComponent(reason)}`,
      );
    };

    try {
      if (oauthError) {
        return fail(oauthError);
      }
      if (!code) {
        return fail("missing_code");
      }
      const stateCheck = this.oauthState.validate(stateCookie, state);
      if (!stateCheck.ok) {
        return fail(stateCheck.reason);
      }

      const tokens = await this.authService.exchangeCode(code);
      const user = await this.authService.getUser(tokens.accessToken);
      const { sessionId, expiresAt } = await this.sessions.createSession(
        user.id,
        tokens,
        {
          userAgent: req.header("user-agent") || undefined,
          ip: req.ip,
        },
      );

      this.oauthState.clearCookie(res);
      this.sessions.setSessionCookie(res, sessionId, expiresAt);
      return res.redirect(`${frontendUrl}/dashboard?login=success`);
    } catch {
      return fail("auth_failed");
    }
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Revoke session and clear cookie" })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookieName = this.sessions.getCookieName();
    const sessionId = req.cookies?.[cookieName] as string | undefined;
    if (sessionId) {
      try {
        const active = await this.sessions.resolveActiveSession(sessionId);
        await this.authService.invalidateDiscordUserCaches(
          String(active.session.userId),
        );
      } catch {
        // Session already gone — still clear cookie below.
      }
    }
    await this.sessions.revoke(sessionId);
    this.sessions.clearSessionCookie(res);
    // Also clear legacy cookie if present
    res.clearCookie("session_token", { path: "/" });
    return { ok: true };
  }

  @Get("me")
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: "Current authenticated user summary" })
  me(@CurrentUser() user: DiscordUser) {
    return {
      id: user.id,
      username: user.username,
      global_name: user.global_name,
      avatar: user.avatar,
      banner: user.banner,
      accent_color: user.accent_color,
    };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard, SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: "Refresh Discord access token server-side" })
  async refresh(@Req() req: Request) {
    const sessionId = req.sessionId;
    if (!sessionId || !req.accessToken) {
      return { ok: false };
    }
    // SessionGuard already refreshed if needed; expose success for clients.
    return {
      ok: true,
      userId: req.discordUser?.id,
    };
  }
}
