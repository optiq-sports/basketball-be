import { Module, Global } from '@nestjs/common';
import { PlayerDeduplicationService } from './services/player-deduplication.service';

@Global()
@Module({
  providers: [PlayerDeduplicationService],
  exports: [PlayerDeduplicationService],
})
export class CommonModule {}

