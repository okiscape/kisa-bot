import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { SessionGuard } from "./session.guard";
import { SessionService } from "../session.service";
import { AuthService } from "../auth.service";

describe("SessionGuard", () => {
  const sessions = {
    getCookieName: () => "kisa_session",
    resolveActiveSession: jest.fn(),
  } as unknown as SessionService;

  const auth = {
    ensureFreshAccessToken: jest.fn(),
  } as unknown as AuthService;

  const guard = new SessionGuard(sessions, auth);

  function mockContext(cookies: Record<string, string> = {}) {
    const request: Record<string, unknown> = { cookies };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getRequest: () => request,
    } as unknown as ExecutionContext & { getRequest: () => Record<string, unknown> };
  }

  it("rejects missing session", async () => {
    (sessions.resolveActiveSession as jest.Mock).mockRejectedValue(
      new UnauthorizedException("nope"),
    );
    await expect(guard.canActivate(mockContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("attaches user and tokens on success", async () => {
    const ctx = mockContext({ kisa_session: "sid" });
    const request = (
      ctx.switchToHttp().getRequest as () => Record<string, unknown>
    )();
    (sessions.resolveActiveSession as jest.Mock).mockResolvedValue({
      session: { id: "sid" },
      accessToken: "a",
      refreshToken: "r",
    });
    (auth.ensureFreshAccessToken as jest.Mock).mockResolvedValue({
      accessToken: "a2",
      user: { id: "1", username: "u" },
    });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.discordUser).toEqual({ id: "1", username: "u" });
    expect(request.sessionId).toBe("sid");
    expect(request.accessToken).toBe("a2");
  });
});
