import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const result = await prisma.$executeRawUnsafe(`
    UPDATE chats
    SET 
      status = 'transferred_external',
      finished = true,
      finished_at = NOW(),
      finished_by = NULL
    WHERE ai_service = 'paused'
      AND (finished IS NULL OR finished = false)
      AND assigned_to IS NULL;
  `)
  
  console.log(`Update execution result. Rows affected: ${result}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
