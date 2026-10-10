import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import * as crypto from "crypto";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers["x-api-key"];

    if (!apiKey) {
      throw new UnauthorizedException("API key is missing");
    }

    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    const clientApiKey = await this.prisma.clientApiKey.findUnique({
      where: { keyHash },
      include: { client: true },
    });

    if (!clientApiKey || !clientApiKey.client.isActive) {
      throw new UnauthorizedException("Invalid or inactive API key");
    }

    // Attach client id to the request so it can be used for tenant filtering
    request.user = {
      clientIds: [clientApiKey.clientId],
      role: "EXTERNAL_CLIENT", // A special role for external B2B access
    };

    // Update last used asynchronously (fire and forget)
    this.prisma.clientApiKey
      .update({
        where: { id: clientApiKey.id },
        data: { lastUsed: new Date() },
      })
      .catch((err) => {
        // Intentionally ignoring error to not fail request
      });

    return true;
  }
}
