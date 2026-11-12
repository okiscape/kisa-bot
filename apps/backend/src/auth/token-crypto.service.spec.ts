import { ConfigService } from "@nestjs/config";
import { TokenCryptoService } from "./token-crypto.service";

describe("TokenCryptoService", () => {
  const config = {
    getOrThrow: (key: string) => {
      if (key === "session.secret") {
        return "test-session-secret-at-least-32-chars!!";
      }
      throw new Error(`missing ${key}`);
    },
  } as unknown as ConfigService;

  const crypto = new TokenCryptoService(config);

  it("round-trips plaintext", () => {
    const token = "discord-access-token-value";
    const encrypted = crypto.encrypt(token);
    expect(encrypted).not.toContain(token);
    expect(crypto.decrypt(encrypted)).toBe(token);
  });

  it("produces different ciphertext for same input", () => {
    const a = crypto.encrypt("same");
    const b = crypto.encrypt("same");
    expect(a).not.toBe(b);
  });

  it("rejects tampered payload", () => {
    const encrypted = crypto.encrypt("token");
    const buf = Buffer.from(encrypted, "base64url");
    buf[buf.length - 1] ^= 0xff;
    expect(() => crypto.decrypt(buf.toString("base64url"))).toThrow();
  });
});
