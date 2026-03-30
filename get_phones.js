const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();
async function main() {
    try {
        const phoneFormats = await prisma.$queryRawUnsafe(`
            SELECT DISTINCT phone 
            FROM chat_messages 
            WHERE phone LIKE '%9178%5173%'
        `);
        fs.writeFileSync('phones.json', JSON.stringify(phoneFormats, null, 2));
    } finally {
        await prisma.$disconnect();
    }
}
main();
