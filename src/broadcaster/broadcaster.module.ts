import { Module } from "@nestjs/common";
import { BroadcasterController } from "./broadcaster.controller";
import { BroadcasterService } from "./broadcaster.service";
import { PrismaModule } from "../prisma/prisma.module";
import { UploadModule } from "../upload/upload.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [PrismaModule, UploadModule, AuditLogsModule, NotificationsModule],
  controllers: [BroadcasterController],
  providers: [BroadcasterService],
  exports: [BroadcasterService],
})
export class BroadcasterModule {}
