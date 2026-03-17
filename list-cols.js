const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  try {
    const logCols = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='chat_transfer_logs'
    `;
    console.log(JSON.stringify(logCols.map(c => c.column_name)));
  } catch(e) {
    console.error(e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
