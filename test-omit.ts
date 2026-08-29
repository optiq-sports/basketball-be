import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({
    omit: { password: true },
    include: { profile: true }
  });
  console.log(users);
}
main();
