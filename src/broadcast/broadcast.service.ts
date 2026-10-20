import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BroadcastClientDto } from "./dto/broadcast-client.dto";
import { AuthenticatedUser } from "../common/interfaces/user.interface";
import { MatchResponseDto } from "../matches/dto/match-response.dto";

@Injectable()
export class BroadcastService {
  constructor(private readonly prisma: PrismaService) {}

  resolveSlug(slugOrParam?: string, hostHeader?: string): string {
    if (slugOrParam && slugOrParam !== "matches") {
      return slugOrParam.toLowerCase().trim();
    }
    if (hostHeader) {
      // Handles hostname like "onesporttv.optiqsports.com" or "onesporttv.localhost"
      const hostname = hostHeader.split(":")[0];
      const parts = hostname.split(".");
      if (parts.length >= 2) {
        const subdomain = parts[0].toLowerCase().trim();
        const reserved = new Set(["www", "api", "app", "localhost", "admin"]);
        if (!reserved.has(subdomain)) {
          return subdomain;
        }
      }
    }
    if (slugOrParam === "matches") {
      throw new BadRequestException(
        "Broadcast client slug must be specified in the path or subdomain",
      );
    }
    throw new BadRequestException(
      "Broadcast client slug could not be determined from path or hostname",
    );
  }

  async getBroadcastClientBySlug(slug: string): Promise<BroadcastClientDto> {
    const normalizedSlug = slug.toLowerCase().trim();
    const client = await this.prisma.client.findFirst({
      where: {
        slug: normalizedSlug,
        clientType: "broadcast",
      },
      select: {
        id: true,
        name: true,
        slug: true,
        clientType: true,
        websiteUrl: true,
        logo: true,
      },
    });

    if (!client || !client.slug) {
      throw new NotFoundException(
        `Broadcast client '${normalizedSlug}' not found`,
      );
    }

    return {
      id: client.id,
      name: client.name,
      slug: client.slug,
      clientType: client.clientType,
      websiteUrl: client.websiteUrl,
      logo: client.logo,
    };
  }

  async getBroadcastMatches(
    slug: string,
    user?: { role?: string; clientIds?: string[] },
  ): Promise<{ client: BroadcastClientDto; matches: MatchResponseDto[] }> {
    const client = await this.getBroadcastClientBySlug(slug);

    if (
      user &&
      user.role === "CLIENT" &&
      user.clientIds &&
      !user.clientIds.includes(client.id)
    ) {
      return {
        client,
        matches: [],
      };
    }

    const matches = await this.prisma.match.findMany({
      where: {
        clientId: client.id,
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        tournament: true,
        statistician: true,
        gameSessions: {
          select: {
            id: true,
            status: true,
            quarter: true,
            clockSecondsRemaining: true,
            homeScore: true,
            awayScore: true,
          },
        },
      },
      orderBy: {
        scheduledDate: "asc",
      },
    });

    return {
      client,
      matches: matches as unknown as MatchResponseDto[],
    };
  }
}
