import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.connectWithRetry();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async connectWithRetry(retries = MAX_RETRIES): Promise<void> {
    try {
      await this.$connect();
    } catch (error: unknown) {
      const isConnectionError =
        error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P1017';
      if (retries > 0 && (isConnectionError || (error instanceof Error && /closed the connection|ECONNRESET|connect/i.test(error.message)))) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return this.connectWithRetry(retries - 1);
      }
      throw error;
    }
  }
}

