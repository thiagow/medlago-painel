const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const output = {};
  try {
    output.columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'departments';
    `;
    output.constraints = await prisma.$queryRaw`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = 'departments'::regclass;
    `;
    fs.writeFileSync('db-diag-depts.json', JSON.stringify(output, null, 2));
    console.log("Diagnosis saved to db-diag-depts.json");
  } catch (e) {
    console.error("Error during diagnosis:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
