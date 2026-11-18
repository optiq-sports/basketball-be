import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { generateMatchKey } from "../src/matches/utils/match-key.util";
import { Logger } from "@nestjs/common";

async function main() {
  const logger = new Logger("BackfillMatchKeys");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });
  const prisma = app.get(PrismaService);

  const matchesWithoutKey = await prisma.match.findMany({
    where: { matchKey: null },
    select: { id: true },
  });

  logger.log(`Found ${matchesWithoutKey.length} matches without matchKey.`);

  let updated = 0;
  for (const m of matchesWithoutKey) {
    let key = generateMatchKey(8);
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await prisma.match.findFirst({ where: { matchKey: key } });
      if (!clash) break;
      key = generateMatchKey(8);
    }
    await prisma.match.update({
      where: { id: m.id },
      data: { matchKey: key },
    });
    updated++;
  }

  logger.log(`Successfully backfilled ${updated} matches with match keys.`);
  await app.close();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});

