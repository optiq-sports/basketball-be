/**
 * One-off: same Prisma shape as StatdashSessionsService.resolveMatchKey (match id branch).
 * Usage: node scripts/replay-match-key-query.js [matchId]
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const matchId = process.argv[2] || "cmooerxwa0007cx1xn1popyco";

async function main() {
  const prisma = new PrismaClient();
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        gameSessions: {
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    });
    if (!match) {
      console.log(JSON.stringify({ outcome: "NOT_FOUND", matchId }, null, 2));
      return;
    }
    console.log(
      JSON.stringify(
        {
          outcome: "OK",
          matchId: match.id,
          sessionCountReturned: match.gameSessions.length,
          latestSessionStatus: match.gameSessions[0]?.status ?? null,
        },
        null,
        2,
      ),
    );
  } catch (e) {
    console.error(
      JSON.stringify(
        {
          outcome: "PRISMA_ERROR",
          name: e.name,
          code: e.code,
          message: e.message,
          meta: e.meta,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
