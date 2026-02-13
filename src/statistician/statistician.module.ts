import { Module } from "@nestjs/common";
import { StatisticianService } from "./statistician.service";
import { StatisticianController } from "./statistician.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [StatisticianController],
  providers: [StatisticianService],
})
export class StatisticianModule {}
