const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const keys = Object.keys(prisma).filter(k => !k.startsWith('_') && !['$connect', '$disconnect', '$on', '$transaction', '$use', '$extends'].includes(k));
  console.log("Prisma Models:", keys);
}

main().catch(console.error).finally(() => prisma.$disconnect());
