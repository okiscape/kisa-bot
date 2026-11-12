import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const bigIntFields = [
  "notifyChannel",
  "joinChannel",
  "leaveChannel",
  "postChannel",
  "muteRole",
  "autoRole",
  "logChannel",
  "verifiedRole",
  "ticketCategory",
  "privateCrChannel",
  "privateCategory",
];

@Injectable()
export class GuildsService {
  constructor(private prisma: PrismaService) {}

  async getSettings(guildId: string) {
    return this.prisma.serverSettings.findUnique({
      where: { guildId: BigInt(guildId) },
    });
  }

  async updateSettings(guildId: string, data: Record<string, unknown>) {
    const processed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (bigIntFields.includes(key) && value !== null) {
        processed[key] = BigInt(value as string);
      } else {
        processed[key] = value;
      }
    }

    return this.prisma.serverSettings.upsert({
      where: { guildId: BigInt(guildId) },
      create: { guildId: BigInt(guildId), ...processed },
      update: processed,
    });
  }

  async deleteSettings(guildId: string) {
    return this.prisma.serverSettings.delete({
      where: { guildId: BigInt(guildId) },
    });
  }
}
