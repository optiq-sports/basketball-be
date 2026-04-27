import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { StatdashProjectionsModule } from "../projections/statdash-projections.module";
import { StatdashRealtimeModule } from "../realtime/statdash-realtime.module";
import { StatdashEventsController } from "./statdash-events.controller";
import { StatdashEventsService } from "./statdash-events.service";

@Module({
  imports: [PrismaModule, StatdashProjectionsModule, StatdashRealtimeModule],
  controllers: [StatdashEventsController],
  providers: [StatdashEventsService],
  exports: [StatdashEventsService],
})
export class StatdashEventsModule {}
