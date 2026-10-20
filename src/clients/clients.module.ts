import { Module } from "@nestjs/common";
import { ClientsController } from "./clients.controller";
import { ClientsService } from "./clients.service";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";

import { OverlayModule } from "../overlay/overlay.module";

@Module({
  imports: [PrismaModule, NotificationsModule, OverlayModule],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
