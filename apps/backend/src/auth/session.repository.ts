import { Injectable } from "@nestjs/common";
import { WebSession } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface CreateSessionInput {
  id: string;
  userId: bigint;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date | null;
  expiresAt: Date;
  userAgentHash?: string | null;
  ipHash?: string | null;
}

@Injectable()
export class SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateSessionInput): Promise<WebSession> {
    return this.prisma.webSession.create({ data });
  }

  findById(id: string): Promise<WebSession | null> {
    return this.prisma.webSession.findUnique({ where: { id } });
  }

  touch(id: string): Promise<WebSession> {
    return this.prisma.webSession.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  updateTokens(
    id: string,
    data: {
      accessTokenEncrypted: string;
      refreshTokenEncrypted: string | null;
      accessTokenExpiresAt: Date;
      refreshTokenExpiresAt: Date | null;
    },
  ): Promise<WebSession> {
    return this.prisma.webSession.update({
      where: { id },
      data: {
        ...data,
        lastUsedAt: new Date(),
      },
    });
  }

  revoke(id: string): Promise<WebSession> {
    return this.prisma.webSession.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async deleteExpired(now = new Date()): Promise<number> {
    const result = await this.prisma.webSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { revokedAt: { not: null } },
        ],
      },
    });
    return result.count;
  }
}
