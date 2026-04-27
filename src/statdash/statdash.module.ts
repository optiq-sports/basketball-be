import { Module } from "@nestjs/common";
import { StatdashSessionsModule } from "./sessions/statdash-sessions.module";
import { StatdashEventsModule } from "./events/statdash-events.module";
import { StatdashProjectionsModule } from "./projections/statdash-projections.module";
import { StatdashRealtimeModule } from "./realtime/statdash-realtime.module";

@Module({
  imports: [
    StatdashSessionsModule,
    StatdashEventsModule,
    StatdashProjectionsModule,
    StatdashRealtimeModule,
  ],
})
export class StatdashModule {}
