import { Module, Global } from "@nestjs/common";
import { PlayerDeduplicationService } from "./services/player-deduplication.service";
import { RedisModule } from "./redis/redis.module";
import { QueueModule } from "./queue/queue.module";

@Global()
@Module({
  imports: [RedisModule, QueueModule],
  providers: [PlayerDeduplicationService],
  exports: [PlayerDeduplicationService, RedisModule, QueueModule],
})
export class CommonModule {}
