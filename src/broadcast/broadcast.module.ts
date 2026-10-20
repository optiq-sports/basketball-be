import { Module } from "@nestjs/common";
import { BroadcastController } from "./broadcast.controller";
import { BroadcastService } from "./broadcast.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [BroadcastController],
  providers: [BroadcastService],
  exports: [BroadcastService],
})
export class BroadcastModule {}
