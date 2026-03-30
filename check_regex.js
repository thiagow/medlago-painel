const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const phone = "+55 62 9178-5173";
    const normalizedPhone = phone.replace(/\D/g, "");
    const phoneVariants = [
        normalizedPhone,
        normalizedPhone.replace(/^55/, ""),
        `55${normalizedPhone}`,
    ];
    try {
        const result = await prisma.$queryRawUnsafe(`
            SELECT COUNT(*) as exact
            FROM chat_messages 
            WHERE regexp_replace(phone, '\\D', '', 'g') = ANY($1::text[])
        `, phoneVariants);
        console.log("Total messages matched:", result[0].exact);
    } finally {
        await prisma.$disconnect();
    }
}
main();
