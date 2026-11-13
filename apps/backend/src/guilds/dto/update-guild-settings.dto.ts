import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import {
  BAD_WORDS_ACTIONS,
  SUPPORTED_LANGUAGES,
} from "../guild-settings.defaults";

const SNOWFLAKE = /^\d{17,20}$/;
const HEX_COLOR = /^#?[0-9A-Fa-f]{6}$/;
const HTTPS_URL = /^https:\/\/.+/i;

export class MessageEmbedConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(256)
  title?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== "")
  @Matches(HEX_COLOR)
  color?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== "")
  @Matches(HTTPS_URL)
  @MaxLength(500)
  url?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(256)
  authorName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== "")
  @Matches(HTTPS_URL)
  @MaxLength(500)
  authorIconUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== "")
  @Matches(HTTPS_URL)
  @MaxLength(500)
  authorUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  footerText?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== "")
  @Matches(HTTPS_URL)
  @MaxLength(500)
  footerIconUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== "")
  @Matches(HTTPS_URL)
  @MaxLength(500)
  thumbnailUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== "")
  @Matches(HTTPS_URL)
  @MaxLength(500)
  imageUrl?: string | null;
}

export class MessageConfigDto {
  @ApiPropertyOptional()
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(SNOWFLAKE)
  channelId?: string | null;

  @ApiPropertyOptional({ enum: ["bot", "webhook"] })
  @IsIn(["bot", "webhook"])
  sender!: "bot" | "webhook";

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== "")
  @Matches(HTTPS_URL)
  @MaxLength(500)
  webhookUrl?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(2000)
  content!: string;

  @ApiPropertyOptional({ type: [MessageEmbedConfigDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageEmbedConfigDto)
  embeds!: MessageEmbedConfigDto[];
}

export class LoggingRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(SNOWFLAKE)
  channelId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== "")
  @Matches(HTTPS_URL)
  @MaxLength(500)
  webhookUrl?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(64)
  eventType!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  ignoreItems!: string[];
}

export class ReactionRoleDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(64)
  emoji!: string;

  @ApiPropertyOptional()
  @Matches(SNOWFLAKE)
  roleId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(SNOWFLAKE)
  messageId?: string | null;
}

export class UpdateGuildSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn([...SUPPORTED_LANGUAGES])
  averageLanguage?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  badWords?: string | null;

  @ApiPropertyOptional({
    description: "Comma-separated moderator user snowflakes",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notifiedModerators?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(SNOWFLAKE)
  notifyChannel?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn([...BAD_WORDS_ACTIONS])
  badWordsAction?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(SNOWFLAKE)
  joinChannel?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(SNOWFLAKE)
  leaveChannel?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(SNOWFLAKE)
  postChannel?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(SNOWFLAKE)
  muteRole?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(SNOWFLAKE)
  autoRole?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(SNOWFLAKE)
  logChannel?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(SNOWFLAKE)
  verifiedRole?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(SNOWFLAKE)
  ticketCategory?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  fareText?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(HEX_COLOR)
  fareColor?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(HTTPS_URL)
  @MaxLength(500)
  fareImage?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  greetText?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(HEX_COLOR)
  greetColor?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(HTTPS_URL)
  @MaxLength(500)
  greetImage?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(SNOWFLAKE)
  privateCrChannel?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(SNOWFLAKE)
  privateCategory?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customGreet?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customFare?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notifyText?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  collectMetrics?: boolean | null;

  @ApiPropertyOptional({ type: MessageConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MessageConfigDto)
  greetingConfig?: MessageConfigDto | null;

  @ApiPropertyOptional({ type: MessageConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MessageConfigDto)
  farewellConfig?: MessageConfigDto | null;

  @ApiPropertyOptional({ type: [LoggingRuleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LoggingRuleDto)
  loggingConfig?: LoggingRuleDto[] | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(SNOWFLAKE)
  honeypotChannel?: string | null;

  @ApiPropertyOptional({ type: [ReactionRoleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReactionRoleDto)
  reactionRoles?: ReactionRoleDto[] | null;
}
