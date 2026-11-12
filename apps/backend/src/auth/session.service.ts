import { createHash, randomBytes } from "crypto";
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { WebSession } from "@prisma/client";
import { CookieOptions, Response } from "express";
import { TokenCryptoService } from "./token-crypto.service";
import { SessionRepository } from "./session.repository";
import { ErrorCodes } from "../common/types/error-codes";

export interface DiscordTokenBundle {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn: number;
  refreshExpiresIn?: number | null;
}

export interface ActiveSession {
  session: WebSession;
  accessToken: string;
  refreshToken: string | null;
}

@Injectable()
export class SessionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionService.name);
  private readonly cookieName: string;
  private readonly ttlDays: number;
  private readonly secure: boolean;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly sessions: SessionRepository,
    private readonly crypto: TokenCryptoService,
    private readonly config: ConfigService,
  ) {
    this.cookieName = config.get<string>("session.cookieName") || "kisa_session";
    this.ttlDays = config.get<number>("session.ttlDays") || 7;
    this.secure = Boolean(config.get<boolean>("session.secure"));
  }

  onModuleInit() {
    this.cleanupTimer = setInterval(
      () => {
        void this.cleanupExpired().catch((err) =>
          this.logger.warn(
            `Session cleanup failed: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
      },
      60 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  getCookieName() {
    return this.cookieName;
  }

  async createSession(
    userId: string,
    tokens: DiscordTokenBundle,
    meta?: { userAgent?: string; ip?: string },
  ): Promise<{ sessionId: string; expiresAt: Date }> {
    const sessionId = randomBytes(32).toString("base64url");
    const now = Date.now();
    const expiresAt = new Date(now + this.ttlDays * 24 * 60 * 60 * 1000);
    const accessTokenExpiresAt = new Date(now + tokens.expiresIn * 1000);
    const refreshTokenExpiresAt =
      tokens.refreshToken && tokens.refreshExpiresIn
        ? new Date(now + tokens.refreshExpiresIn * 1000)
        : tokens.refreshToken
          ? new Date(now + 30 * 24 * 60 * 60 * 1000)
          : null;

    await this.sessions.create({
      id: sessionId,
      userId: BigInt(userId),
      accessTokenEncrypted: this.crypto.encrypt(tokens.accessToken),
      refreshTokenEncrypted: tokens.refreshToken
        ? this.crypto.encrypt(tokens.refreshToken)
        : null,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      expiresAt,
      userAgentHash: meta?.userAgent
        ? this.hash(meta.userAgent)
        : null,
      ipHash: meta?.ip ? this.hash(meta.ip) : null,
    });

    return { sessionId, expiresAt };
  }

  setSessionCookie(res: Response, sessionId: string, expiresAt: Date) {
    res.cookie(this.cookieName, sessionId, {
      ...this.cookieOptions(),
      expires: expiresAt,
    });
  }

  clearSessionCookie(res: Response) {
    res.clearCookie(this.cookieName, this.cookieOptions());
  }

  async resolveActiveSession(
    sessionId: string | undefined,
  ): Promise<ActiveSession> {
    if (!sessionId) {
      throw new UnauthorizedException({
        code: ErrorCodes.UNAUTHENTICATED,
        message: "Not authenticated",
      });
    }

    const session = await this.sessions.findById(sessionId);
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        code: ErrorCodes.SESSION_EXPIRED,
        message: "Session expired or revoked",
      });
    }

    let accessToken: string;
    let refreshToken: string | null = null;
    try {
      accessToken = this.crypto.decrypt(session.accessTokenEncrypted);
      refreshToken = session.refreshTokenEncrypted
        ? this.crypto.decrypt(session.refreshTokenEncrypted)
        : null;
    } catch {
      this.logger.warn(`Failed to decrypt session ${session.id}`);
      throw new UnauthorizedException({
        code: ErrorCodes.SESSION_EXPIRED,
        message: "Invalid session",
      });
    }

    void this.sessions.touch(session.id).catch(() => undefined);

    return { session, accessToken, refreshToken };
  }

  async rotateTokens(
    sessionId: string,
    tokens: DiscordTokenBundle,
  ): Promise<void> {
    const now = Date.now();
    await this.sessions.updateTokens(sessionId, {
      accessTokenEncrypted: this.crypto.encrypt(tokens.accessToken),
      refreshTokenEncrypted: tokens.refreshToken
        ? this.crypto.encrypt(tokens.refreshToken)
        : null,
      accessTokenExpiresAt: new Date(now + tokens.expiresIn * 1000),
      refreshTokenExpiresAt:
        tokens.refreshToken && tokens.refreshExpiresIn
          ? new Date(now + tokens.refreshExpiresIn * 1000)
          : tokens.refreshToken
            ? new Date(now + 30 * 24 * 60 * 60 * 1000)
            : null,
    });
  }

  async revoke(sessionId: string | undefined): Promise<void> {
    if (!sessionId) return;
    try {
      await this.sessions.revoke(sessionId);
    } catch {
      // already gone
    }
  }

  async cleanupExpired(): Promise<number> {
    return this.sessions.deleteExpired();
  }

  isAccessTokenExpired(session: WebSession, skewMs = 30_000): boolean {
    return session.accessTokenExpiresAt.getTime() <= Date.now() + skewMs;
  }

  private hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.secure,
      sameSite: "lax",
      path: "/",
    };
  }
}
