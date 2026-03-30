const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('public.pacientes', 'id'), COALESCE(MAX(id), 1)) FROM pacientes;`);
        console.log("SUCCESS: Sequence fixed");
    } catch(e) { console.error(e.message) }
}
main().finally(() => prisma.$disconnect());
