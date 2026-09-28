import { PrismaClient, MatchStatus } from "@prisma/client";
import { randomItem, randomInt, randomCode, tournamentNames } from "./utils";

export async function seedTournamentsAndMatches(
  prisma: PrismaClient,
  clients: any[],
  teams: any[],
  statisticians: any[]
) {
  console.log("Seeding tournaments, matches, and game sessions...");

  const divisions = ["PREMIER", "DIVISION_1", "DIVISION_2", "DIVISION_3", "JUNIOR"] as const;

  // 1. Create 6 Tournaments (assigned to different clients)
  const tournaments = [];
  const matchDistribution = [3, 2, 2, 1, 1, 1]; // Total 10 matches
  
  let matchCount = 0;

  for (let i = 0; i < 6; i++) {
    const client = clients[i % clients.length];
    
    const tournament = await prisma.tournament.create({
      data: {
        name: tournamentNames[i % tournamentNames.length] + ` 202${randomInt(4, 6)}`,
        division: randomItem([...divisions]),
        numberOfGames: matchDistribution[i],
        quarterDuration: 10,
        startDate: new Date(),
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
        code: randomCode(6),
        clientId: client.id,
      }
    });

    // Add random teams to tournament
    const numTeams = randomInt(4, 6);
    const shuffledTeams = [...teams].sort(() => 0.5 - Math.random());
    const tTeams = shuffledTeams.slice(0, numTeams);
    
    for (const team of tTeams) {
      await prisma.tournamentTeam.create({
        data: {
          tournamentId: tournament.id,
          teamId: team.id,
        }
      });
    }

    tournaments.push({ tournament, teams: tTeams, matchCount: matchDistribution[i] });
  }

  // 2. Create 10 Matches and GameSessions
  const matches = [];
  
  for (const t of tournaments) {
    for (let m = 0; m < t.matchCount; m++) {
      if (t.teams.length < 2) continue; // safety check
      
      const homeTeam = t.teams[0];
      const awayTeam = t.teams[1];
      const stat = randomItem(statisticians);
      const isCompleted = Math.random() > 0.5;

      const match = await prisma.match.create({
        data: {
          tournamentId: t.tournament.id,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          scheduledDate: new Date(new Date().getTime() + randomInt(-10, 10) * 86400000),
          status: isCompleted ? "COMPLETED" : "SCHEDULED",
          clientId: t.tournament.clientId,
          statisticianId: stat.id,
          matchKey: randomCode(8),
          homeScore: isCompleted ? randomInt(70, 120) : 0,
          awayScore: isCompleted ? randomInt(70, 120) : 0,
        }
      });

      // 3. Create GameSession for the match
      const session = await prisma.gameSession.create({
        data: {
          matchId: match.id,
          status: isCompleted ? "COMPLETED" : "PENDING",
          homeScore: match.homeScore,
          awayScore: match.awayScore,
        }
      });

      // 4. Create ProjectionState
      await prisma.projectionState.create({
        data: {
          sessionId: session.id,
          projectionType: "BOX_SCORE",
          payload: { summary: "Mock box score data" },
          version: 1
        }
      });

      matches.push(match);
      
      // Shuffle teams for the next match in the same tournament
      t.teams = [...t.teams].sort(() => 0.5 - Math.random());
    }
  }

  return { tournaments, matches };
}
