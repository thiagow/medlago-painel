const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const broadcasts = await prisma.broadcast.findMany({
        orderBy: { id: "desc" },
        take: 3
    });
    
    // Converter BigInt para string antes de imprimir
    const printable = broadcasts.map(b => {
        const obj = { ...b };
        for (const key in obj) {
            if (typeof obj[key] === 'bigint') {
                obj[key] = obj[key].toString();
            }
        }
        return obj;
    });

    console.log(JSON.stringify(printable, null, 2));
    process.exit(0);
}

main().catch(console.error);
