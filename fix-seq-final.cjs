const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const maxIdRes = await prisma.$queryRawUnsafe(`SELECT MAX(id) as max FROM pacientes;`);
        const maxId = Number(maxIdRes[0].max) || 1;
        await prisma.$executeRawUnsafe(`SELECT setval('"Pacientes_id_seq"', ${maxId + 1}, false);`);
        console.log("SUCCESS! Sequence reset to", maxId + 1);
    } catch(e) { console.error(e) }
}
main().finally(() => prisma.$disconnect());
