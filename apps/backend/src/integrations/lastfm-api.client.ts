import { createHash } from "crypto";
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ErrorCodes } from "../common/types/error-codes";

export type LastfmSession = {
  username: string;
  sessionKey: string;
};

@Injectable()
export class LastfmApiClient {
  private readonly logger = new Logger(LastfmApiClient.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>("lastfm.apiKey") &&
        this.config.get<string>("lastfm.apiSecret") &&
        this.config.get<string>("lastfm.redirectUri"),
    );
  }

  assertConfigured() {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({
        code: ErrorCodes.SERVICE_UNAVAILABLE,
        message: "Last.fm OAuth is not configured",
      });
    }
  }

  buildAuthorizeUrl(): string {
    this.assertConfigured();
    const url = new URL("https://www.last.fm/api/auth/");
    url.searchParams.set(
      "api_key",
      this.config.getOrThrow<string>("lastfm.apiKey"),
    );
    url.searchParams.set(
      "cb",
      this.config.getOrThrow<string>("lastfm.redirectUri"),
    );
    return url.toString();
  }

  async getSession(token: string): Promise<LastfmSession> {
    this.assertConfigured();
    const apiKey = this.config.getOrThrow<string>("lastfm.apiKey");
    const apiSecret = this.config.getOrThrow<string>("lastfm.apiSecret");

    const params: Record<string, string> = {
      method: "auth.getSession",
      api_key: apiKey,
      token,
    };
    params.api_sig = this.sign(params, apiSecret);
    params.format = "json";

    const url = new URL("https://ws.audioscrobbler.com/2.0/");
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      this.logger.warn(`last.fm getSession failed (${res.status}): ${text}`);
      throw new Error("lastfm_session_failed");
    }

    const json = (await res.json()) as {
      session?: { name: string; key: string };
      error?: number;
      message?: string;
    };

    if (!json.session?.name || !json.session?.key) {
      this.logger.warn(
        `last.fm getSession missing session: ${json.message ?? "unknown"}`,
      );
      throw new Error("lastfm_session_failed");
    }

    return {
      username: json.session.name,
      sessionKey: json.session.key,
    };
  }

  /** Last.fm api_sig = md5(sorted key+value pairs + secret). */
  private sign(params: Record<string, string>, secret: string): string {
    const base = Object.keys(params)
      .sort()
      .map((key) => `${key}${params[key]}`)
      .join("");
    return createHash("md5").update(`${base}${secret}`).digest("hex");
  }
}
