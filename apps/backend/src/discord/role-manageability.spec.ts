import {
  annotateRolesForBot,
  botHighestRolePosition,
  roleManageability,
} from "./role-manageability";
import type { DiscordApiRole } from "./discord.types";

function role(
  partial: Partial<DiscordApiRole> & Pick<DiscordApiRole, "id" | "name" | "position">,
): DiscordApiRole {
  return {
    color: 0,
    mentionable: false,
    hoist: false,
    managed: false,
    ...partial,
  };
}

describe("role-manageability", () => {
  const guildId = "100";
  const botId = "bot-1";

  const roles: DiscordApiRole[] = [
    role({ id: "10", name: "Admin", position: 10 }),
    role({
      id: "5",
      name: "Kisa",
      position: 5,
      managed: true,
      tags: { bot_id: botId },
    }),
    role({ id: "3", name: "Green", position: 3 }),
    role({
      id: "2",
      name: "OtherBot",
      position: 2,
      managed: true,
      tags: { bot_id: "other" },
    }),
    role({ id: guildId, name: "@everyone", position: 0 }),
  ];

  it("resolves bot top position from member roles", () => {
    expect(botHighestRolePosition(roles, botId, ["5", "3"])).toBe(5);
  });

  it("falls back to tags.bot_id when member roles are empty", () => {
    expect(botHighestRolePosition(roles, botId, [])).toBe(5);
  });

  it("marks roles above the bot as unmanageable", () => {
    expect(roleManageability(roles[0], guildId, 5)).toEqual({
      manageable: false,
      reason: "Above or equal to the bot's highest role",
    });
  });

  it("marks managed roles as unmanageable", () => {
    expect(roleManageability(roles[3], guildId, 5).manageable).toBe(false);
  });

  it("allows roles below the bot", () => {
    expect(roleManageability(roles[2], guildId, 5)).toEqual({
      manageable: true,
      reason: null,
    });
  });

  it("does not hierarchy-block when bot top is unresolved", () => {
    expect(roleManageability(roles[0], guildId, 0).manageable).toBe(true);
    expect(roleManageability(roles[3], guildId, 0).manageable).toBe(false);
  });

  it("annotates the full role list", () => {
    const annotated = annotateRolesForBot(roles, guildId, botId, ["5"]);
    expect(annotated.find((r) => r.id === "10")?.manageable).toBe(false);
    expect(annotated.find((r) => r.id === "3")?.manageable).toBe(true);
    expect(annotated.find((r) => r.id === "2")?.manageable).toBe(false);
    expect(annotated.find((r) => r.id === guildId)?.manageable).toBe(false);
  });
});
