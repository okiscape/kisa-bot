import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionService } from "./session.service";
import { SessionRepository } from "./session.repository";
import { TokenCryptoService } from "./token-crypto.service";
import { OauthStateService } from "./oauth-state.service";
import { SessionGuard } from "./guards/session.guard";
import { GuildAdminGuard } from "./guards/guild-admin.guard";
import { CsrfGuard } from "./guards/csrf.guard";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    SessionRepository,
    TokenCryptoService,
    OauthStateService,
    SessionGuard,
    GuildAdminGuard,
    CsrfGuard,
  ],
  exports: [
    AuthService,
    SessionService,
    SessionGuard,
    GuildAdminGuard,
    CsrfGuard,
  ],
})
export class AuthModule {}
