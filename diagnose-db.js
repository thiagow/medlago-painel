const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("--- Columns for user_departments ---");
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'user_departments';
    `;
    console.log(JSON.stringify(columns, null, 2));

    console.log("--- Constraints for user_departments ---");
    const constraints = await prisma.$queryRaw`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = 'user_departments'::regclass;
    `;
    console.log(JSON.stringify(constraints, null, 2));

  } catch (e) {
    console.error("Error during diagnosis:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
