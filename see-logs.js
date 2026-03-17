const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  try {
    const logs = await prisma.$queryRaw`SELECT * FROM chat_transfer_logs LIMIT 5`;
    console.log(JSON.stringify(logs, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
  } catch(e) {
    console.error(e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
