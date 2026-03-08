import { Module } from "@nestjs/common";
import { StatisticianService } from "./statistician.service";
import { StatisticianController } from "./statistician.controller";
import { UploadModule } from "../upload/upload.module";

@Module({
  imports: [UploadModule],
  controllers: [StatisticianController],
  providers: [StatisticianService],
})
export class StatisticianModule {}
