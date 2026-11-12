import { ConfigService } from "@nestjs/config";
import { DiscordApiClient } from "./discord-api.client";

describe("DiscordApiClient", () => {
  const config = {
    get: (key: string) => {
      const map: Record<string, string> = {
        "discord.clientId": "client",
        "discord.clientSecret": "secret",
        "discord.redirectUri": "http://localhost/cb",
        "discord.botToken": "bot-token",
        "discord.botPermissions": "8",
      };
      return map[key];
    },
    getOrThrow: (key: string) => {
      const map: Record<string, string> = {
        "discord.clientId": "client",
        "discord.clientSecret": "secret",
        "discord.redirectUri": "http://localhost/cb",
        "discord.botToken": "bot-token",
        DISCORD_CLIENT_ID: "client",
        DISCORD_CLIENT_SECRET: "secret",
        DISCORD_REDIRECT_URI: "http://localhost/cb",
        DISCORD_BOT_TOKEN: "bot-token",
      };
      if (!(key in map)) throw new Error(key);
      return map[key];
    },
  } as unknown as ConfigService;

  const client = new DiscordApiClient(config);
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("builds bot invite URL with guild targeting", () => {
    const url = client.getBotInviteUrl("123");
    expect(url).toContain("client_id=client");
    expect(url).toContain("permissions=8");
    expect(url).toContain("guild_id=123");
    expect(url).toContain("scope=bot+applications.commands");
  });

  it("retries after Discord 429 then succeeds", async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: false,
          status: 429,
          headers: { get: () => "0" },
          json: async () => ({}),
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => [{ id: "1", name: "g", icon: null, owner: true, permissions: "8", features: [] }],
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const guilds = await client.getUserGuilds("user-token");
    expect(guilds).toHaveLength(1);
    expect(calls).toBe(2);
  });

  it("paginates bot guilds", async () => {
    let calls = 0;
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      calls += 1;
      const url = String(input);
      if (calls === 1) {
        expect(url).toContain("limit=200");
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => Array.from({ length: 200 }, (_, i) => ({ id: String(i + 1) })),
        } as unknown as Response;
      }
      expect(url).toContain("after=200");
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => [{ id: "201" }],
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const ids = await client.getBotGuildIds();
    expect(ids).toHaveLength(201);
    expect(calls).toBe(2);
  });
});
