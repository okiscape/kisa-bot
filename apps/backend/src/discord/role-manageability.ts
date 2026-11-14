import type { DiscordApiRole } from "./discord.types";

export type RoleManageability = {
  manageable: boolean;
  reason: string | null;
};

/**
 * Highest role position Discord will use for hierarchy checks for the bot.
 * Prefers the member role list, with the integration role (`tags.bot_id`) as fallback.
 */
export function botHighestRolePosition(
  roles: readonly DiscordApiRole[],
  botUserId: string,
  botMemberRoleIds: readonly string[],
): number {
  const byId = new Map(roles.map((r) => [String(r.id), r]));
  const positions: number[] = [];

  for (const id of botMemberRoleIds) {
    const role = byId.get(String(id));
    if (role && Number.isFinite(role.position)) positions.push(role.position);
  }

  const tagged = roles.find(
    (r) => r.tags?.bot_id != null && String(r.tags.bot_id) === String(botUserId),
  );
  if (tagged && Number.isFinite(tagged.position)) {
    positions.push(tagged.position);
  }

  return positions.length > 0 ? Math.max(...positions) : 0;
}

/**
 * Whether the bot can assign/remove this role (Manage Roles + hierarchy).
 * When the bot's top position cannot be resolved, only managed/@everyone are blocked.
 */
export function roleManageability(
  role: DiscordApiRole,
  guildId: string,
  botTopPosition: number,
): RoleManageability {
  if (String(role.id) === String(guildId)) {
    return { manageable: false, reason: "Cannot assign @everyone" };
  }
  if (role.managed) {
    return {
      manageable: false,
      reason: "Managed by an integration and cannot be assigned",
    };
  }
  // Unresolved hierarchy: don't blanket-reject (bot may only have @everyone in edge cases).
  if (botTopPosition > 0 && role.position >= botTopPosition) {
    return {
      manageable: false,
      reason: "Above or equal to the bot's highest role",
    };
  }
  return { manageable: true, reason: null };
}

export function annotateRolesForBot(
  roles: readonly DiscordApiRole[],
  guildId: string,
  botUserId: string,
  botMemberRoleIds: readonly string[],
): Array<
  DiscordApiRole & { manageable: boolean; manageReason: string | null }
> {
  const botTopPosition = botHighestRolePosition(
    roles,
    botUserId,
    botMemberRoleIds,
  );
  return roles.map((role) => {
    const { manageable, reason } = roleManageability(
      role,
      guildId,
      botTopPosition,
    );
    return { ...role, manageable, manageReason: reason };
  });
}
