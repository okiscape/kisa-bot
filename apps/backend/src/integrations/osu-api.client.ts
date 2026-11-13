import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ErrorCodes } from "../common/types/error-codes";

export type OsuTokenResponse = {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  tokenType: string;
};

export type OsuUser = {
  id: number;
  username: string;
  avatarUrl: string | null;
  countryCode: string | null;
};

@Injectable()
export class OsuApiClient {
  private readonly logger = new Logger(OsuApiClient.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>("osu.clientId") &&
        this.config.get<string>("osu.clientSecret") &&
        this.config.get<string>("osu.redirectUri"),
    );
  }

  assertConfigured() {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({
        code: ErrorCodes.SERVICE_UNAVAILABLE,
        message: "osu! OAuth is not configured",
      });
    }
  }

  buildAuthorizeUrl(state: string): string {
    this.assertConfigured();
    const url = new URL("https://osu.ppy.sh/oauth/authorize");
    url.searchParams.set(
      "client_id",
      this.config.getOrThrow<string>("osu.clientId"),
    );
    url.searchParams.set(
      "redirect_uri",
      this.config.getOrThrow<string>("osu.redirectUri"),
    );
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "identify public");
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCode(code: string): Promise<OsuTokenResponse> {
    this.assertConfigured();
    const body = new URLSearchParams({
      client_id: this.config.getOrThrow<string>("osu.clientId"),
      client_secret: this.config.getOrThrow<string>("osu.clientSecret"),
      redirect_uri: this.config.getOrThrow<string>("osu.redirectUri"),
      grant_type: "authorization_code",
      code,
    });

    const res = await fetch("https://osu.ppy.sh/oauth/token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      this.logger.warn(`osu token exchange failed (${res.status}): ${text}`);
      throw new Error("osu_token_exchange_failed");
    }

    const json = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
    };

    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? null,
      expiresIn: json.expires_in,
      tokenType: json.token_type,
    };
  }

  async getMe(accessToken: string): Promise<OsuUser> {
    const res = await fetch("https://osu.ppy.sh/api/v2/me", {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      this.logger.warn(`osu /me failed (${res.status}): ${text}`);
      throw new Error("osu_me_failed");
    }

    const json = (await res.json()) as {
      id: number;
      username: string;
      avatar_url?: string;
      country_code?: string;
    };

    return {
      id: json.id,
      username: json.username,
      avatarUrl: json.avatar_url ?? null,
      countryCode: json.country_code ?? null,
    };
  }
}
