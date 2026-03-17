const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  try {
    const aiServices = await prisma.$queryRaw`SELECT DISTINCT ai_service FROM chats`;
    console.log("AI Services:", aiServices);
    
    const logCols = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='chat_transfer_logs'
    `;
    console.log("ChatTransferLog Columns:", logCols);
  } catch(e) {
    console.error(e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
