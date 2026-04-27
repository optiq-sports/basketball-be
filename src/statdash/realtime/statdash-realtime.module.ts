import { Module } from "@nestjs/common";
import { StatdashRealtimeController } from "./statdash-realtime.controller";
import { StatdashRealtimeService } from "./statdash-realtime.service";

@Module({
  controllers: [StatdashRealtimeController],
  providers: [StatdashRealtimeService],
  exports: [StatdashRealtimeService],
})
export class StatdashRealtimeModule {}
