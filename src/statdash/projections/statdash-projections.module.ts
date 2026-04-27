import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { StatdashProjectionsController } from "./statdash-projections.controller";
import { StatdashProjectionsService } from "./statdash-projections.service";

@Module({
  imports: [PrismaModule],
  controllers: [StatdashProjectionsController],
  providers: [StatdashProjectionsService],
  exports: [StatdashProjectionsService],
})
export class StatdashProjectionsModule {}
