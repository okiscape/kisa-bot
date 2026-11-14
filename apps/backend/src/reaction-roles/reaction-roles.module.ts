import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ReactionRolesController } from "./reaction-roles.controller";
import { ReactionRolesService } from "./reaction-roles.service";

@Module({
  imports: [AuthModule],
  controllers: [ReactionRolesController],
  providers: [ReactionRolesService],
  exports: [ReactionRolesService],
})
export class ReactionRolesModule {}
