import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const pausedChats = await prisma.chat.findMany({
    where: {
      ai_service: 'paused',
      finished: false,
    },
    orderBy: { updated_at: 'desc' },
    select: {
      id: true, phone: true, ai_service: true, status: true, created_at: true, updated_at: true, assigned_to: true
    }
  })

  console.log("Total paused not finished (Na aba Humano):", pausedChats.length);
  console.log(JSON.stringify(pausedChats, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
}

main().catch(e => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
