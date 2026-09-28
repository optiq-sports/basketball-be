import { PrismaClient } from "@prisma/client";
import { firstNames, lastNames, teamNames, colors, positions, randomItem, randomInt, randomCode } from "./utils";

export async function seedTeamsAndPlayers(prisma: PrismaClient) {
  console.log("Seeding teams and players...");

  // 1. Create 100 Players
  const players = [];
  for (let i = 0; i < 100; i++) {
    const fName = randomItem(firstNames);
    const lName = randomItem(lastNames);
    const player = await prisma.player.create({
      data: {
        firstName: fName,
        lastName: lName,
        email: `${fName.toLowerCase()}.${lName.toLowerCase()}${i}@optiqsport.com`,
        position: randomItem([...positions]),
        height: `${randomInt(5, 7)}'${randomInt(0, 11)}"`,
        dateOfBirth: new Date(randomInt(1990, 2005), randomInt(0, 11), randomInt(1, 28)),
      }
    });
    players.push(player);
  }

  // 2. Create 8 Teams
  const teams = [];
  for (let i = 0; i < 8; i++) {
    const team = await prisma.team.create({
      data: {
        name: `${randomItem(["City", "State", "Metro", "United", "Rovers", "Rangers"])} ${teamNames[i]}`,
        code: randomCode(4),
        color: colors[i],
        coach: `${randomItem(firstNames)} ${randomItem(lastNames)}`,
      }
    });
    teams.push(team);
  }

  // 3. Assign 85% of players to teams (approx 8-12 per team)
  // Let's just assign exactly 10 players to each of the 8 teams (80 players total, which is 80%)
  let playerIndex = 0;
  for (const team of teams) {
    for (let j = 0; j < 10; j++) {
      if (playerIndex >= players.length) break;
      await prisma.playerTeam.create({
        data: {
          playerId: players[playerIndex].id,
          teamId: team.id,
          jerseyNumber: j + 1,
          isCaptain: j === 0, // first player is captain
        }
      });
      playerIndex++;
    }
  }

  return { players, teams };
}
