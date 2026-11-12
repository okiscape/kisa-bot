import { Controller, Get, Res, HttpStatus } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { HealthService } from "./health.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get("live")
  @ApiOperation({ summary: "Liveness probe (no dependencies)" })
  live() {
    return this.health.live();
  }

  @Get("ready")
  @ApiOperation({ summary: "Readiness probe (database + redis)" })
  async ready(@Res({ passthrough: true }) res: Response) {
    const result = await this.health.ready();
    if (result.status === "error") {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }

  @Get()
  @ApiOperation({ summary: "Compact health summary" })
  async summary(@Res({ passthrough: true }) res: Response) {
    const result = await this.health.summary();
    if (result.status === "error") {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
