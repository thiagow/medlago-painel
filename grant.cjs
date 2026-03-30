const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    await prisma.$executeRawUnsafe(`GRANT USAGE, SELECT ON SEQUENCE chat_message_delete_logs_id_seq TO user_medlago_app;`);
    console.log("GRANT SUCCESSFUL");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
