import { Module } from "@nestjs/common";
import { ClientApiController } from "./client-api.controller";
import { ClientApiService } from "./client-api.service";
import { PrismaModule } from "../prisma/prisma.module";
import { StatdashProjectionsModule } from "../statdash/projections/statdash-projections.module";
import { StatdashRealtimeModule } from "../statdash/realtime/statdash-realtime.module";

@Module({
  imports: [PrismaModule, StatdashProjectionsModule, StatdashRealtimeModule],
  controllers: [ClientApiController],
  providers: [ClientApiService],
})
export class ClientApiModule {}
