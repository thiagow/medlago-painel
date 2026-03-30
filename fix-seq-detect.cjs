const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const res = await prisma.$queryRawUnsafe(`SELECT relname FROM pg_class WHERE relkind = 'S' AND relname LIKE '%paciente%';`);
    console.log("Found sequences:", res);
    
    if (res.length > 0) {
        const seqName = res[0].relname;
        console.log(`Fixing sequence: ${seqName}`);
        await prisma.$executeRawUnsafe(`SELECT setval('${seqName}', COALESCE((SELECT MAX(id) FROM pacientes), 1));`);
        console.log("SEQUENCE FIXED");
    } else {
        console.log("No sequence found!");
    }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
