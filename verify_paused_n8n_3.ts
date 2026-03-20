import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const pausedChats = await prisma.chat.findMany({
    where: {
      ai_service: 'paused',
      finished: false,
    }
  })

  // Destes, quantos NÃO possuem assigned_to?
  const semAtendente = pausedChats.filter(c => c.assigned_to === null);

  console.log("Total na aba Humano (paused, finished=false):", pausedChats.length);
  console.log("Deste total, sem atendente atribuído:", semAtendente.length);
}

main().catch(e => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
