import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";
import { AuthService } from "../auth/auth.service";
import { SessionService } from "../auth/session.service";
import { SessionGuard } from "../auth/guards/session.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { DiscordUser } from "../auth/discord-user.interface";
import { OauthStateService } from "../auth/oauth-state.service";
import { SkipEnvelope } from "../common/decorators/skip-envelope.decorator";
import { IntegrationsService } from "./integrations.service";
import { OsuApiClient } from "./osu-api.client";
import { LastfmApiClient } from "./lastfm-api.client";

@ApiTags("integrations")
@Controller()
export class IntegrationsController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly osu: OsuApiClient,
    private readonly lastfm: LastfmApiClient,
    private readonly oauthState: OauthStateService,
    private readonly sessions: SessionService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private frontendIntegrationsUrl(query: string) {
    const frontendUrl = this.config.getOrThrow<string>("frontendUrl");
    return `${frontendUrl}/dashboard/integrations${query}`;
  }

  private async resolveLinkedUser(req: Request): Promise<DiscordUser | null> {
    try {
      const cookieName = this.sessions.getCookieName();
      const sessionId = req.cookies?.[cookieName] as string | undefined;
      const active = await this.sessions.resolveActiveSession(sessionId);
      const { user } = await this.auth.ensureFreshAccessToken(active);
      return user;
    } catch {
      return null;
    }
  }

  @Get("users/@me/integrations")
  @ApiCookieAuth()
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: "Linked osu! / Last.fm status (no secrets)" })
  getMyIntegrations(@CurrentUser() user: DiscordUser) {
    return this.integrations.getStatus(user.id);
  }

  @Get("auth/osu/login")
  @SkipEnvelope()
  @UseGuards(SessionGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiCookieAuth()
  @ApiOperation({ summary: "Start osu! OAuth2 account link" })
  osuLogin(@Res() res: Response) {
    this.osu.assertConfigured();
    const state = this.oauthState.createState();
    this.oauthState.setCookie(res, state);
    return res.redirect(this.osu.buildAuthorizeUrl(state));
  }

  @Get("auth/osu/callback")
  @SkipEnvelope()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "osu! OAuth2 callback" })
  async osuCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") oauthError: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const fail = (reason: string) => {
      this.oauthState.clearCookie(res);
      return res.redirect(
        this.frontendIntegrationsUrl(`?error=${encodeURIComponent(reason)}`),
      );
    };

    try {
      if (oauthError) return fail(oauthError);
      if (!code) return fail("missing_code");

      const user = await this.resolveLinkedUser(req);
      if (!user) return fail("not_authenticated");

      const stateCookie = req.cookies?.[this.oauthState.cookieName()] as
        | string
        | undefined;
      const stateCheck = this.oauthState.validate(stateCookie, state);
      if (!stateCheck.ok) return fail(stateCheck.reason);

      const tokens = await this.osu.exchangeCode(code);
      const osuUser = await this.osu.getMe(tokens.accessToken);
      await this.integrations.linkOsu(user.id, tokens, osuUser);

      this.oauthState.clearCookie(res);
      return res.redirect(this.frontendIntegrationsUrl("?osu=linked"));
    } catch {
      return fail("osu_link_failed");
    }
  }

  @Delete("auth/osu/link")
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: "Unlink osu! account" })
  unlinkOsu(@CurrentUser() user: DiscordUser) {
    return this.integrations.unlinkOsu(user.id);
  }

  @Get("auth/lastfm/login")
  @SkipEnvelope()
  @UseGuards(SessionGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiCookieAuth()
  @ApiOperation({ summary: "Start Last.fm auth link" })
  lastfmLogin(@Res() res: Response) {
    this.lastfm.assertConfigured();
    // Last.fm does not echo state; still set a short-lived marker cookie.
    const state = this.oauthState.createState();
    this.oauthState.setCookie(res, state);
    return res.redirect(this.lastfm.buildAuthorizeUrl());
  }

  @Get("auth/lastfm/callback")
  @SkipEnvelope()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Last.fm auth callback" })
  async lastfmCallback(
    @Query("token") token: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const fail = (reason: string) => {
      this.oauthState.clearCookie(res);
      return res.redirect(
        this.frontendIntegrationsUrl(`?error=${encodeURIComponent(reason)}`),
      );
    };

    try {
      if (!token) return fail("missing_token");
      const user = await this.resolveLinkedUser(req);
      if (!user) return fail("not_authenticated");
      const session = await this.lastfm.getSession(token);
      await this.integrations.linkLastfm(user.id, session);
      this.oauthState.clearCookie(res);
      return res.redirect(this.frontendIntegrationsUrl("?lastfm=linked"));
    } catch {
      return fail("lastfm_link_failed");
    }
  }

  @Delete("auth/lastfm/link")
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: "Unlink Last.fm account" })
  unlinkLastfm(@CurrentUser() user: DiscordUser) {
    return this.integrations.unlinkLastfm(user.id);
  }
}
