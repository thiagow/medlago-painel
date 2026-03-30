const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const res = await prisma.$queryRawUnsafe(`
            SELECT column_name, column_default, is_identity, identity_generation 
            FROM information_schema.columns 
            WHERE table_name = 'pacientes' AND column_name = 'id';
        `);
        console.log(res);

        const maxIdRes = await prisma.$queryRawUnsafe(`SELECT MAX(id) as max FROM pacientes;`);
        const maxId = Number(maxIdRes[0].max) || 1;
        console.log("Max ID is:", maxId);

        // If it's identity:
        if (res[0].is_identity === 'YES') {
            await prisma.$executeRawUnsafe(`ALTER TABLE pacientes ALTER COLUMN id RESTART WITH ${maxId + 1};`);
            console.log("Identity sequence restarted!");
        } else if (res[0].column_default && res[0].column_default.includes('nextval')) {
            // Extract sequence name from nextval('...')
            const match = res[0].column_default.match(/'([^']+)'/);
            if (match && match[1]) {
                const seq = match[1];
                await prisma.$executeRawUnsafe(`SELECT setval('${seq}', ${maxId + 1}, false);`);
                console.log("Sequence", seq, "fixed");
            }
        }
    } catch (e) { console.error(e) }
}

main().finally(() => prisma.$disconnect());
