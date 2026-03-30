const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    await prisma.$executeRawUnsafe(`SELECT setval('pacientes_id_seq', COALESCE((SELECT MAX(id) FROM pacientes), 1));`);
    console.log("SEQUENCE FIXED");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
