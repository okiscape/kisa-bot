import { ConfigService } from "@nestjs/config";
import { UnauthorizedException } from "@nestjs/common";
import { SessionService } from "./session.service";
import { SessionRepository } from "./session.repository";
import { TokenCryptoService } from "./token-crypto.service";
import { WebSession } from "@prisma/client";

describe("SessionService", () => {
  const secret = "test-session-secret-at-least-32-chars!!";
  const config = {
    getOrThrow: (key: string) => {
      if (key === "session.secret") return secret;
      throw new Error(key);
    },
    get: (key: string) => {
      if (key === "session.cookieName") return "kisa_session";
      if (key === "session.ttlDays") return 7;
      if (key === "session.secure") return false;
      if (key === "session.secret") return secret;
      return undefined;
    },
  } as unknown as ConfigService;

  const crypto = new TokenCryptoService(config);
  let repo: jest.Mocked<Pick<
    SessionRepository,
    "create" | "findById" | "touch" | "updateTokens" | "revoke" | "deleteExpired"
  >>;
  let service: SessionService;

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      findById: jest.fn(),
      touch: jest.fn(),
      updateTokens: jest.fn(),
      revoke: jest.fn(),
      deleteExpired: jest.fn(),
    };
    service = new SessionService(
      repo as unknown as SessionRepository,
      crypto,
      config,
    );
  });

  it("creates an opaque session id and encrypts tokens", async () => {
    repo.create.mockImplementation(async (data) => data as never);
    const result = await service.createSession("123", {
      accessToken: "access",
      refreshToken: "refresh",
      expiresIn: 3600,
    });
    expect(result.sessionId.length).toBeGreaterThanOrEqual(40);
    expect(repo.create).toHaveBeenCalled();
    const created = repo.create.mock.calls[0][0];
    expect(created.accessTokenEncrypted).not.toContain("access");
    expect(created.refreshTokenEncrypted).not.toContain("refresh");
  });

  it("rejects missing session", async () => {
    await expect(service.resolveActiveSession(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects expired session", async () => {
    repo.findById.mockResolvedValue({
      id: "s1",
      userId: 1n,
      accessTokenEncrypted: crypto.encrypt("a"),
      refreshTokenEncrypted: null,
      accessTokenExpiresAt: new Date(Date.now() + 60_000),
      refreshTokenExpiresAt: null,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
      userAgentHash: null,
      ipHash: null,
    } as WebSession);

    await expect(service.resolveActiveSession("s1")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects revoked session", async () => {
    repo.findById.mockResolvedValue({
      id: "s1",
      userId: 1n,
      accessTokenEncrypted: crypto.encrypt("a"),
      refreshTokenEncrypted: null,
      accessTokenExpiresAt: new Date(Date.now() + 60_000),
      refreshTokenExpiresAt: null,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      userAgentHash: null,
      ipHash: null,
    } as WebSession);

    await expect(service.resolveActiveSession("s1")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("resolves a valid session and decrypts tokens", async () => {
    repo.findById.mockResolvedValue({
      id: "s1",
      userId: 1n,
      accessTokenEncrypted: crypto.encrypt("access-token"),
      refreshTokenEncrypted: crypto.encrypt("refresh-token"),
      accessTokenExpiresAt: new Date(Date.now() + 60_000),
      refreshTokenExpiresAt: new Date(Date.now() + 86_400_000),
      createdAt: new Date(),
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: null,
      userAgentHash: null,
      ipHash: null,
    } as WebSession);
    repo.touch.mockResolvedValue({} as WebSession);

    const active = await service.resolveActiveSession("s1");
    expect(active.accessToken).toBe("access-token");
    expect(active.refreshToken).toBe("refresh-token");
  });
});
