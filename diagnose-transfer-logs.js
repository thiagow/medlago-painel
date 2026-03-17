const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const output = {};
  try {
    output.columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'chat_transfer_logs';
    `;
    fs.writeFileSync('db-diag-transfer-logs.json', JSON.stringify(output, null, 2));
    console.log("Diagnosis saved to db-diag-transfer-logs.json");
  } catch (e) {
    console.error("Error during diagnosis:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
