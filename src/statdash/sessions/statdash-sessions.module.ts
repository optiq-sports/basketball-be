import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { StatdashSessionsRepository } from "./statdash-sessions.repository";
import { StatdashSessionsService } from "./statdash-sessions.service";
import { StatdashSessionsController } from "./statdash-sessions.controller";

@Module({
  imports: [PrismaModule],
  controllers: [StatdashSessionsController],
  providers: [StatdashSessionsRepository, StatdashSessionsService],
  exports: [StatdashSessionsRepository, StatdashSessionsService],
})
export class StatdashSessionsModule {}
