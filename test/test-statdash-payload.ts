import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import request = require("supertest");
import * as bcrypt from "bcrypt";
import { Role } from "@prisma/client";

async function run() {
  console.log("Initializing App...");
  const app = await NestFactory.create(AppModule);
  await app.init();

  const prisma = app.get<PrismaService>(PrismaService);

  console.log("Checking for superadmin user...");
  let user = await prisma.user.findFirst({ where: { email: "test-statdash2@optiq.com" } });
  if (!user) {
    const hashedPassword = await bcrypt.hash("superadmin123", 10);
    user = await prisma.user.create({
      data: {
        email: "test-statdash2@optiq.com",
        password: hashedPassword,
        role: Role.SUPER_ADMIN,
        name: "Test User",
        emailVerified: true,
      },
    });
  }

  console.log("Logging in...");
  let token = "";
  try {
    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "test-statdash2@optiq.com", password: "superadmin123" })
      .expect(201);
    token = loginRes.body.data ? loginRes.body.data.access_token : loginRes.body.access_token;
  } catch (e) {
    console.error("Login failed:", e);
    process.exit(1);
  }

  console.log("Creating Session and Match data if needed...");
  
  let homeTeam = await prisma.team.findFirst({ where: { name: "Home Test Team" } });
  if (!homeTeam) {
    homeTeam = await prisma.team.create({
      data: { name: "Home Test Team", code: "HTT" }
    });
  }

  let awayTeam = await prisma.team.findFirst({ where: { name: "Away Test Team" } });
  if (!awayTeam) {
    awayTeam = await prisma.team.create({
      data: { name: "Away Test Team", code: "ATT" }
    });
  }
  
  let player = await prisma.player.findFirst({ where: { firstName: "Test", lastName: "Shooter" } });
  if (!player) {
    player = await prisma.player.create({
      data: { firstName: "Test", lastName: "Shooter", email: "test.shooter@optiq.com" }
    });
  }

  let tournament = await prisma.tournament.findFirst({ where: { name: "Test Tournament" } });
  if (!tournament) {
    tournament = await prisma.tournament.create({
      data: {
        name: "Test Tournament",
        division: "PREMIER",
        numberOfGames: 1,
        numberOfQuarters: 4,
        quarterDuration: 10,
        startDate: new Date(),
        code: "TT-1234"
      }
    });
  }

  let match = await prisma.match.findFirst({ where: { tournamentId: tournament.id, homeTeamId: homeTeam.id, awayTeamId: awayTeam.id } });
  if (!match) {
    match = await prisma.match.create({
      data: {
        tournamentId: tournament.id,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        scheduledDate: new Date(),
      }
    });
  }

  let gameSession = await prisma.gameSession.findFirst({ where: { matchId: match.id } });
  if (!gameSession) {
    gameSession = await prisma.gameSession.create({
      data: {
        matchId: match.id,
        status: "IN_PROGRESS",
      }
    });
  }

  console.log("Executing StatDash Command...");
  const commandPayload = {
    sessionId: gameSession.id,
    expectedVersion: gameSession.version,
    commandType: "shot",
    idempotencyKey: "test-shot-key-1",
    payload: {
      teamId: homeTeam.id,
      clockSecondsRemaining: 600,
      quarter: 1,
      shooterPlayerId: player.id,
      shot: {
        result: "made",
        value: 2,
        type: "jumpshot"
      }
    }
  };

  try {
    const res = await request(app.getHttpServer())
      .post("/statdash/events/command")
      .set("Authorization", `Bearer ${token}`)
      .send(commandPayload);
      
    console.log("Response Status:", res.status);
    console.log("Response Body:", JSON.stringify(res.body, null, 2));
    
  } catch(e) {
    console.error("Request failed:", e);
  }

  const savedEvent = await prisma.gameEvent.findFirst({
    where: { sessionId: gameSession.id },
    orderBy: { sequence: 'desc' }
  });
  
  if (savedEvent) {
     console.log("Latest Event in DB for session:", savedEvent);
  } else {
     console.log("No event was written to the DB.");
  }

  await app.close();
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
