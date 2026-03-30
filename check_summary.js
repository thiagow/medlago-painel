const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const phone = "+55 62 9178-5173";
    const normalizedPhone = phone.replace(/\D/g, "");
    const phoneVariants = [
        normalizedPhone,
        normalizedPhone.replace(/^55/, ""),
        `55${normalizedPhone}`,
        `${normalizedPhone}@s.whatsapp.net`,
        `55${normalizedPhone}@s.whatsapp.net`,
        `${normalizedPhone.replace(/^55/, "")}@s.whatsapp.net`
    ];

    try {
        const aggs = await prisma.$queryRawUnsafe(`
            SELECT 
                COUNT(*) as total_msgs,
                COUNT(DISTINCT conversation_id) as total_groups
            FROM chat_messages 
            WHERE phone LIKE '%9178%5173%'
        `);
        
        console.log(`Summary: ${aggs[0].total_msgs} msgs across ${aggs[0].total_groups} convs`);

        const phoneFormats = await prisma.$queryRawUnsafe(`
            SELECT DISTINCT phone 
            FROM chat_messages 
            WHERE phone LIKE '%9178%5173%'
        `);
        console.log("Distinct phones found:");
        phoneFormats.forEach(p => console.log(`- "${p.phone}"`));

        const allConvs = await prisma.$queryRawUnsafe(`
            SELECT DISTINCT conversation_id 
            FROM chat_messages 
            WHERE phone LIKE '%9178%5173%'
              AND conversation_id IS NOT NULL
        `);
        
        const convIds = allConvs.map(c => c.conversation_id);
        
        const validChats = await prisma.$queryRawUnsafe(`
            SELECT COUNT(*) as valid 
            FROM chats 
            WHERE conversation_id = ANY($1::text[])
        `, convIds);
        
        console.log(`Chats in DB matching those ${convIds.length} convs: ${validChats[0].valid}`);

        // Checking phone on the chats directly
        const chatsByPhone = await prisma.$queryRawUnsafe(`
            SELECT COUNT(*) as c 
            FROM chats 
            WHERE phone = ANY($1::text[])
        `, phoneVariants);
        
        console.log(`Chats in DB matching phone natively: ${chatsByPhone[0].c}`);

    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
