import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";
import {
  BAD_WORDS_ACTIONS,
  SUPPORTED_LANGUAGES,
} from "../guild-settings.defaults";

const SNOWFLAKE = /^\d{17,20}$/;
const HEX_COLOR = /^#?[0-9A-Fa-f]{6}$/;
const HTTPS_URL = /^https:\/\/.+/i;

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
}
