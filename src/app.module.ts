import { Module } from "@nestjs/common";
import { WinstonModule } from "nest-winston";
import logger from "./logger/logger";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { CommonModule } from "./common/common.module";
import { AuthModule } from "./auth/auth.module";
import { PlayersModule } from "./players/players.module";
import { TeamsModule } from "./teams/teams.module";
import { TournamentsModule } from "./tournaments/tournaments.module";
import { MatchesModule } from "./matches/matches.module";
import { AdminModule } from "./admin/admin.module";
import { StatisticianModule } from "./statistician/statistician.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { UploadModule } from "./upload/upload.module";
import { StatdashModule } from "./statdash/statdash.module";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [
    WinstonModule.forRoot({
      instance: logger,
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: parseInt(
            configService.get<string>("THROTTLE_TTL") || "60000",
            10,
          ),
          limit: parseInt(
            configService.get<string>("THROTTLE_LIMIT") || "100",
            10,
          ),
        },
      ],
    }),
    PrismaModule,
    CommonModule,
    AuthModule,
    PlayersModule,
    TeamsModule,
    TournamentsModule,
    MatchesModule,
    AdminModule,
    StatisticianModule,
    UploadModule,
    StatdashModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
