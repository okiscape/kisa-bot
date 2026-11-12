import { ConfigService } from "@nestjs/config";
import { OauthStateService } from "./oauth-state.service";

describe("OauthStateService", () => {
  const config = {
    getOrThrow: () => "test-session-secret-at-least-32-chars!!",
    get: (key: string) => (key === "session.secure" ? false : undefined),
  } as unknown as ConfigService;

  const service = new OauthStateService(config);

  it("validates matching state", () => {
    const state = service.createState();
    const signed = service.sign(state);
    expect(service.validate(signed, state)).toEqual({ ok: true });
  });

  it("rejects mismatched state", () => {
    const state = service.createState();
    const signed = service.sign(state);
    expect(service.validate(signed, "other-state")).toEqual({
      ok: false,
      reason: "state_mismatch",
    });
  });

  it("rejects missing cookie", () => {
    expect(service.validate(undefined, "x")).toEqual({
      ok: false,
      reason: "missing_state_cookie",
    });
  });

  it("rejects missing query state", () => {
    expect(service.validate("a.b.c", undefined)).toEqual({
      ok: false,
      reason: "missing_state_param",
    });
  });

  it("rejects expired payload", () => {
    const state = "abc";
    const exp = Date.now() - 1000;
    const crypto = require("crypto") as typeof import("crypto");
    const payload = `${state}.${exp}`;
    const sig = crypto
      .createHmac("sha256", "test-session-secret-at-least-32-chars!!")
      .update(payload)
      .digest("base64url");
    expect(service.validate(`${payload}.${sig}`, state)).toEqual({
      ok: false,
      reason: "state_expired",
    });
  });
});
