import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";

/** Bot-compatible UTC offsets (UTC, UTC±1 … UTC±12) or loose IANA ids. */
const TIMEZONE =
  /^(UTC([+-](1[0-2]|[0-9]))?|[A-Za-z]+\/[A-Za-z0-9_+\-]+(?:\/[A-Za-z0-9_+\-]+)?)$/;

export class UpdateUserSettingsDto {
  @ApiPropertyOptional({
    description: "UTC offset string used by the bot (e.g. UTC+3) or IANA id",
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(TIMEZONE, {
    message: "timezone must be UTC, UTC±N, or an IANA timezone id",
  })
  timezone?: string | null;
}
