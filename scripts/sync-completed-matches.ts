import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { StatdashProjectionsService } from "../src/statdash/projections/statdash-projections.service";
import { Logger } from "@nestjs/common";

async function main() {
  const logger = new Logger("SyncCompletedMatches");
  logger.log("Starting match score sync for completed matches...");

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });

  const prisma = app.get(PrismaService);
  const projectionsService = app.get(StatdashProjectionsService);

  // Find all matches that are COMPLETED or have COMPLETED sessions
  const matches = await prisma.match.findMany({
    where: {
      OR: [
        { status: "COMPLETED" },
        { gameSessions: { some: { status: "COMPLETED" } } },
      ],
    },
    include: {
      gameSessions: {
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  logger.log(`Found ${matches.length} completed matches to verify/sync.`);

  let syncedCount = 0;
  for (const match of matches) {
    const session = match.gameSessions[0];
    if (!session) {
      logger.warn(`Match ${match.id} has no game sessions to sync.`);
      continue;
    }

    try {
      logger.log(`Rebuilding and syncing projections for match ${match.id} (session ${session.id})...`);
      await projectionsService.rebuildAndPersist(session.id);
      syncedCount++;
    } catch (err: unknown) {
      const error = err as Error;
      logger.error(`Failed to sync match ${match.id}: ${error.message}`);
    }
  }

  logger.log(`Sync completed. Successfully synced ${syncedCount}/${matches.length} matches.`);
  await app.close();
}

main().catch((err) => {
  console.error("Score sync failed:", err);
  process.exit(1);
});
