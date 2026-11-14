import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { GuildAdminGuard } from "../auth/guards/guild-admin.guard";
import { UpsertReactionRoleDto } from "./dto/upsert-reaction-role.dto";
import { ReactionRolesService } from "./reaction-roles.service";

@ApiTags("reaction-roles")
@ApiCookieAuth()
@Controller("guilds/:guildId/reaction-roles")
@UseGuards(GuildAdminGuard)
export class ReactionRolesController {
  constructor(private readonly reactionRoles: ReactionRolesService) {}

  @Get()
  @ApiOperation({ summary: "List reaction role panels for a guild" })
  list(@Param("guildId") guildId: string) {
    return this.reactionRoles.list(guildId);
  }

  @Get("emojis")
  @ApiOperation({ summary: "Guild custom emojis for the picker" })
  emojis(@Param("guildId") guildId: string) {
    return this.reactionRoles.getEmojis(guildId);
  }

  @Post()
  @ApiOperation({ summary: "Create a reaction role panel and post/attach" })
  create(
    @Param("guildId") guildId: string,
    @Body() body: UpsertReactionRoleDto,
  ) {
    return this.reactionRoles.create(guildId, body);
  }

  @Patch(":panelId")
  @ApiOperation({ summary: "Update a reaction role panel" })
  update(
    @Param("guildId") guildId: string,
    @Param("panelId") panelId: string,
    @Body() body: UpsertReactionRoleDto,
  ) {
    return this.reactionRoles.update(guildId, panelId, body);
  }

  @Delete(":panelId")
  @ApiOperation({ summary: "Delete a reaction role panel" })
  async remove(
    @Param("guildId") guildId: string,
    @Param("panelId") panelId: string,
  ) {
    await this.reactionRoles.remove(guildId, panelId);
    return { deleted: true };
  }
}
