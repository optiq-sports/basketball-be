// import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
// import { PrismaClient } from '@prisma/client';

// const MAX_RETRIES = 10;
// const RETRY_DELAY_MS = 3000;

// @Injectable()
// export class PrismaService
//   extends PrismaClient
//   implements OnModuleInit, OnModuleDestroy
// {
//   private readonly logger = new Logger(PrismaService.name);

//   async onModuleInit() {
//     await this.connectWithRetry();
//   }

//   async onModuleDestroy() {
//     await this.$disconnect();
//   }

//   private async connectWithRetry(retries = MAX_RETRIES): Promise<void> {
//     try {
//       await this.$connect();
//       this.logger.log('Connected to PostgreSQL');
//     } catch (error: any) {
//       const code = error?.code;

//       const retryableCodes = [
//         'P1001', // Can't reach database
//         'P1017', // Server closed connection
//       ];

//       const retryableMessage =
//         /ECONNRESET|ETIMEDOUT|closed the connection|connect/i.test(
//           error?.message ?? '',
//         );

//       if (retries > 0 && (retryableCodes.includes(code) || retryableMessage)) {
//         this.logger.warn(
//           `Database connection failed (${code ?? 'unknown'}). Retrying... (${retries} left)`,
//         );

//         await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));

//         return this.connectWithRetry(retries - 1);
//       }

//       throw error;
//     }
//   }
// }







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
      // console.log('DATABASE_URL:', process.env.DATABASE_URL);
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

