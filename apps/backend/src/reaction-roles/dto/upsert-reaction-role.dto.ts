import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";
import {
  MAX_REACTION_ROLE_PAIRS,
  MESSAGE_CONTENT_MAX,
  REACTION_ROLE_MODES,
  REACTION_ROLE_TYPES,
} from "../reaction-roles.constants";

const SNOWFLAKE = /^\d{17,20}$/;

export class ReactionRoleEmbedFieldDto {
  @ApiProperty()
  @IsString()
  @MaxLength(256)
  name!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(1024)
  value!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  inline?: boolean;
}

export class ReactionRoleEmbedDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  title?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  color?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  url?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  authorName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  authorIconUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  authorUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  footerText?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  footerIconUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  thumbnailUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  imageUrl?: string | null;

  @ApiPropertyOptional({ type: [ReactionRoleEmbedFieldDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => ReactionRoleEmbedFieldDto)
  fields?: ReactionRoleEmbedFieldDto[];
}

export class ReactionRolePairInputDto {
  @ApiProperty({
    description: "Unicode emoji or custom `name:id` / `a:name:id`",
  })
  @IsString()
  @MaxLength(64)
  emoji!: string;

  @ApiProperty()
  @IsString()
  @Matches(SNOWFLAKE)
  roleId!: string;
}

export class UpsertReactionRoleDto {
  @ApiProperty({ enum: REACTION_ROLE_MODES })
  @IsIn([...REACTION_ROLE_MODES])
  mode!: (typeof REACTION_ROLE_MODES)[number];

  @ApiProperty({ enum: REACTION_ROLE_TYPES })
  @IsIn([...REACTION_ROLE_TYPES])
  type!: (typeof REACTION_ROLE_TYPES)[number];

  @ApiProperty()
  @IsString()
  @Matches(SNOWFLAKE)
  channelId!: string;

  @ApiPropertyOptional({
    description:
      "Required for mode=existing. Message ID or discord.com/channels/... link.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  messageRef?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(MESSAGE_CONTENT_MAX)
  content?: string;

  @ApiPropertyOptional({ type: ReactionRoleEmbedDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReactionRoleEmbedDto)
  embed?: ReactionRoleEmbedDto | null;

  @ApiProperty({ type: [ReactionRolePairInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_REACTION_ROLE_PAIRS)
  @ValidateNested({ each: true })
  @Type(() => ReactionRolePairInputDto)
  pairs!: ReactionRolePairInputDto[];
}
