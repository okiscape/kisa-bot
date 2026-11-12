import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AuthController } from "../src/auth/auth.controller";
import { AuthService } from "../src/auth/auth.service";
import { SessionService } from "../src/auth/session.service";
import { OauthStateService } from "../src/auth/oauth-state.service";
import { ConfigService } from "@nestjs/config";
import { CsrfGuard } from "../src/auth/guards/csrf.guard";
import { SessionGuard } from "../src/auth/guards/session.guard";
import { GlobalExceptionFilter } from "../src/common/filters/http-exception.filter";
import { ResponseEnvelopeInterceptor } from "../src/common/interceptors/response.interceptor";
import { Reflector } from "@nestjs/core";

describe("AuthController (e2e-ish)", () => {
  let app: INestApplication;
  const authService = {
    exchangeCode: jest.fn(),
    getUser: jest.fn(),
    ensureFreshAccessToken: jest.fn(),
  };
  const sessions = {
    getCookieName: () => "kisa_session",
    createSession: jest.fn(),
    setSessionCookie: jest.fn(),
    clearSessionCookie: jest.fn(),
    revoke: jest.fn(),
    resolveActiveSession: jest.fn(),
  };
  const oauthState = {
    cookieName: () => "kisa_oauth_state",
    createState: () => "test-state",
    setCookie: jest.fn(),
    clearCookie: jest.fn(),
    validate: jest.fn(),
  };
  const config = {
    getOrThrow: (key: string) => {
      const map: Record<string, string> = {
        "discord.clientId": "client",
        "discord.redirectUri": "http://localhost:3001/api/auth/discord/callback",
        frontendUrl: "http://localhost:3000",
      };
      return map[key];
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: SessionService, useValue: sessions },
        { provide: OauthStateService, useValue: oauthState },
        { provide: ConfigService, useValue: config },
        CsrfGuard,
        SessionGuard,
        Reflector,
        ResponseEnvelopeInterceptor,
      ],
    })
      .overrideGuard(SessionGuard)
      .useValue({
        canActivate: (ctx: { switchToHttp: () => { getRequest: () => Record<string, unknown> } }) => {
          const req = ctx.switchToHttp().getRequest();
          req.discordUser = {
            id: "1",
            username: "tester",
            global_name: "Tester",
            avatar: null,
            banner: null,
            accent_color: null,
            avatar_decoration_data: null,
            collectibles: null,
          };
          req.sessionId = "sid";
          req.accessToken = "token";
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /api/auth/me without session override still works via mock guard", async () => {
    const res = await request(app.getHttpServer()).get("/api/auth/me").expect(200);
    expect(res.body.data || res.body).toMatchObject({
      id: "1",
      username: "tester",
    });
  });

  it("POST /api/auth/logout requires CSRF header", async () => {
    await request(app.getHttpServer()).post("/api/auth/logout").expect(403);
  });

  it("POST /api/auth/logout clears session with CSRF header", async () => {
    sessions.revoke.mockResolvedValue(undefined);
    const res = await request(app.getHttpServer())
      .post("/api/auth/logout")
      .set("X-Requested-With", "fetch")
      .expect(200);
    expect(res.body.data || res.body).toEqual({ ok: true });
    expect(sessions.revoke).toHaveBeenCalled();
    expect(sessions.clearSessionCookie).toHaveBeenCalled();
  });

  it("callback rejects invalid state", async () => {
    oauthState.validate.mockReturnValue(false);
    const res = await request(app.getHttpServer())
      .get("/api/auth/discord/callback")
      .query({ code: "abc", state: "bad" })
      .expect(302);
    expect(res.headers.location).toContain("error=invalid_state");
  });

  it("callback creates session on success", async () => {
    oauthState.validate.mockReturnValue(true);
    authService.exchangeCode.mockResolvedValue({
      accessToken: "a",
      refreshToken: "r",
      expiresIn: 3600,
    });
    authService.getUser.mockResolvedValue({ id: "99", username: "u" });
    sessions.createSession.mockResolvedValue({
      sessionId: "opaque",
      expiresAt: new Date(Date.now() + 86400000),
    });

    const res = await request(app.getHttpServer())
      .get("/api/auth/discord/callback")
      .query({ code: "abc", state: "test-state" })
      .expect(302);

    expect(res.headers.location).toContain("/dashboard?login=success");
    expect(sessions.createSession).toHaveBeenCalled();
    expect(sessions.setSessionCookie).toHaveBeenCalled();
  });
});
