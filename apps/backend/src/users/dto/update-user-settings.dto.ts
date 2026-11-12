import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";

/** Loose IANA-ish timezone: Area/Location or UTC±offset. */
const TIMEZONE =
  /^(UTC|[A-Za-z]+\/[A-Za-z0-9_+\-]+(?:\/[A-Za-z0-9_+\-]+)?)$/;

const OSU_USERNAME = /^[A-Za-z0-9_\-\[\] ]{2,32}$/;

export class UpdateUserSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(TIMEZONE, { message: "timezone must be an IANA timezone id" })
  timezone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(OSU_USERNAME, {
    message: "osuUsername must be 2-32 chars (letters, numbers, _ - [ ] space)",
  })
  osuUsername?: string | null;
}
