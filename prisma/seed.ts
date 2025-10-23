import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  const password = 'password123' // you can change this
  const passwordHash = await bcrypt.hash(password, 10)

  const user = await prisma.user.upsert({
    where: { email: 'test@basketball.com' },
    update: {},
    create: {
      email: 'test@basketball.com',
      passwordHash,
      role: 'ADMIN',
      emailVerified: new Date(),
      profile: {
        create: {
          fullName: 'Test Admin',
          sportType: 'Basketball',
          bio: 'Coach of the university basketball team',
          avatarUrl: 'https://example.com/avatar.png',
        },
      },
    },
  })

  console.log(' Seed complete: ', user)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
