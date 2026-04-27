import { Global, Module } from "@nestjs/common";
import { QueueService } from "./queue.service";
import { QueueWorkerService } from "./queue-worker.service";
import { PrismaModule } from "../../prisma/prisma.module";
import { RedisModule } from "../redis/redis.module";
import { QueueController } from "./queue.controller";

@Global()
@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [QueueController],
  providers: [QueueService, QueueWorkerService],
  exports: [QueueService],
})
export class QueueModule {}
