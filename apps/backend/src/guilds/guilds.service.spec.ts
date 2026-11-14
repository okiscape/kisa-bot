import { GuildsService } from "./guilds.service";
import { DiscordApiGuild } from "../discord/discord.types";

describe("GuildsService discovery mapping", () => {
  let service: GuildsService;
  let discord: {
    getUserGuilds: jest.Mock;
    getBotGuildIds: jest.Mock;
    getGuild: jest.Mock;
    getGuildRoles: jest.Mock;
    getGuildChannels: jest.Mock;
    getBotInviteUrl: jest.Mock;
  };

  beforeEach(() => {
    const cache = {
      getOrSet: jest.fn(
        async (_key: string, factory: () => Promise<unknown>) => ({
          value: await factory(),
          cache: "MISS" as const,
        }),
      ),
    };

    discord = {
      getUserGuilds: jest.fn(),
      getBotGuildIds: jest.fn(),
      getGuild: jest.fn(),
      getGuildRoles: jest.fn(),
      getGuildChannels: jest.fn(),
      getBotInviteUrl: jest.fn((id: string) => `invite:${id}`),
    };

    const auth = {
      hasRequiredPermission: (g: DiscordApiGuild) => {
        if (g.owner) return true;
        const bits = BigInt(g.permissions);
        return (bits & 0x8n) !== 0n || (bits & 0x20n) !== 0n;
      },
      getCachedUserGuilds: jest.fn(async () => discord.getUserGuilds()),
      getCachedBotGuildIds: jest.fn(async () => discord.getBotGuildIds()),
    };

    service = new GuildsService(
      {} as never,
      cache as never,
      discord as never,
      auth as never,
    );
  });

  it("sorts hasBot first, then inviteable, then name", async () => {
    const guilds: DiscordApiGuild[] = [
      {
        id: "3",
        name: "Zebra",
        icon: null,
        owner: true,
        permissions: "8",
        features: [],
      },
      {
        id: "1",
        name: "Alpha",
        icon: null,
        owner: true,
        permissions: "8",
        features: [],
      },
      {
        id: "2",
        name: "Beta",
        icon: null,
        owner: true,
        permissions: "8",
        features: [],
      },
    ];
    discord.getUserGuilds.mockResolvedValue(guilds);
    discord.getBotGuildIds.mockResolvedValue(["2"]);

    const result = await service.listGuilds("tok", "user", "manageable");
    expect(result.map((g) => g.id)).toEqual(["2", "1", "3"]);
    expect(result[0].hasBot).toBe(true);
    expect(result[1].canInviteBot).toBe(true);
    expect(result[1].botInviteUrl).toBe("invite:1");
  });

  it("filters to manageable only by default", async () => {
    discord.getUserGuilds.mockResolvedValue([
      {
        id: "1",
        name: "Admin",
        icon: null,
        owner: false,
        permissions: "8",
        features: [],
      },
      {
        id: "2",
        name: "Member",
        icon: null,
        owner: false,
        permissions: "0",
        features: [],
      },
    ] satisfies DiscordApiGuild[]);
    discord.getBotGuildIds.mockResolvedValue([]);

    const manageable = await service.listGuilds("tok", "user", "manageable");
    expect(manageable.map((g) => g.id)).toEqual(["1"]);

    const all = await service.listGuilds("tok", "user", "all");
    expect(all).toHaveLength(2);
    expect(all.find((g) => g.id === "2")?.isManageable).toBe(false);
  });
});
