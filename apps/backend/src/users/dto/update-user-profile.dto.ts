import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";

const HEX_COLOR = /^#?[0-9A-Fa-f]{6}$/;
const HTTPS_URL = /^https:\/\/.+/i;

export class UpdateUserProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  aboutMe?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(HEX_COLOR)
  color?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(HTTPS_URL)
  @MaxLength(500)
  customImage?: string | null;
}
