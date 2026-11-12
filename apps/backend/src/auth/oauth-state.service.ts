import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CookieOptions, Response } from "express";

const STATE_COOKIE = "kisa_oauth_state";
const STATE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class OauthStateService {
  private readonly secret: string;
  private readonly secure: boolean;

  constructor(config: ConfigService) {
    this.secret = config.getOrThrow<string>("session.secret");
    this.secure = Boolean(config.get<boolean>("session.secure"));
  }

  cookieName() {
    return STATE_COOKIE;
  }

  createState(): string {
    return randomBytes(32).toString("base64url");
  }

  sign(state: string): string {
    const exp = Date.now() + STATE_TTL_MS;
    const payload = `${state}.${exp}`;
    const sig = createHmac("sha256", this.secret).update(payload).digest("base64url");
    return `${payload}.${sig}`;
  }

  setCookie(res: Response, state: string) {
    res.cookie(STATE_COOKIE, this.sign(state), this.cookieOptions());
  }

  clearCookie(res: Response) {
    res.clearCookie(STATE_COOKIE, this.cookieOptions());
  }

  /**
   * Validates the signed cookie value against the OAuth `state` query param.
   * Returns a reason string suitable for `?error=` on failure.
   */
  validate(
    signedCookie: string | undefined,
    stateFromQuery: string | undefined,
  ): { ok: true } | { ok: false; reason: string } {
    if (!stateFromQuery) {
      return { ok: false, reason: "missing_state_param" };
    }
    if (!signedCookie) {
      return { ok: false, reason: "missing_state_cookie" };
    }

    const parts = signedCookie.split(".");
    if (parts.length !== 3) {
      return { ok: false, reason: "invalid_state_cookie" };
    }
    const [state, expRaw, sig] = parts;
    const exp = Number(expRaw);
    if (!state || !sig || !Number.isFinite(exp)) {
      return { ok: false, reason: "invalid_state_cookie" };
    }
    if (Date.now() > exp) {
      return { ok: false, reason: "state_expired" };
    }

    const payload = `${state}.${expRaw}`;
    const expected = createHmac("sha256", this.secret)
      .update(payload)
      .digest("base64url");

    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "invalid_state_signature" };
    }

    const stateBuf = Buffer.from(state);
    const queryBuf = Buffer.from(stateFromQuery);
    if (
      stateBuf.length !== queryBuf.length ||
      !timingSafeEqual(stateBuf, queryBuf)
    ) {
      return { ok: false, reason: "state_mismatch" };
    }

    return { ok: true };
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      // Only Secure on real HTTPS; NODE_ENV=production over HTTP drops cookies in browsers.
      secure: this.secure,
      sameSite: "lax",
      path: "/",
      maxAge: STATE_TTL_MS,
    };
  }
}
