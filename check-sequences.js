const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.$queryRaw`
      SELECT relname as sequence_name
      FROM pg_class
      WHERE relkind = 'S'
      AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
    `;
    fs.writeFileSync('all-sequences.json', JSON.stringify(result, null, 2));
    console.log("Sequences saved to all-sequences.json");
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
