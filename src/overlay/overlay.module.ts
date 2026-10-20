import { Module } from "@nestjs/common";
import { OverlayController } from "./overlay.controller";
import { OverlayService } from "./overlay.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [OverlayController],
  providers: [OverlayService],
  exports: [OverlayService],
})
export class OverlayModule {}
