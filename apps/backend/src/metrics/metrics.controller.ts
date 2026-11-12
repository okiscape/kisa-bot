import { Controller, Get, Res, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { MetricsService } from "./metrics.service";
import { SessionGuard } from "../auth/guards/session.guard";

@ApiTags("metrics")
@Controller("metrics")
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @ApiOperation({ summary: "Public bot metrics summary (from bot_metrics)" })
  async getSummary(@Res({ passthrough: true }) res: Response) {
    const { data, cache } = await this.metrics.getSummary();
    res.setHeader("X-Cache", cache);
    return data;
  }

  @Get("detailed")
  @ApiCookieAuth()
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: "Authenticated detailed bot metrics" })
  async getDetailed(@Res({ passthrough: true }) res: Response) {
    const { data, cache } = await this.metrics.getDetailed();
    res.setHeader("X-Cache", cache);
    return data;
  }
}
