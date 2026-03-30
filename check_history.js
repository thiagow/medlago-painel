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
        const groupByConv = await prisma.$queryRawUnsafe(`
            SELECT conversation_id, COUNT(*) as count 
            FROM chat_messages 
            WHERE phone = ANY($1::text[])
            GROUP BY conversation_id
        `, phoneVariants);
        
        console.log(`Total groups (distinct conversation_ids): ${groupByConv.length}`);
        
        let totalCount = 0;
        let nullOrEmptyCount = 0;
        const convIds = [];

        for (const g of groupByConv) {
            const c = Number(g.count);
            totalCount += c;
            if (!g.conversation_id) {
                nullOrEmptyCount += c;
            } else {
                convIds.push(g.conversation_id);
            }
        }
        console.log(`Total messages for phone: ${totalCount}`);
        console.log(`Messages with null/empty conversation_id: ${nullOrEmptyCount}`);

        const chatsForTheseConvs = await prisma.$queryRawUnsafe(`
            SELECT conversation_id 
            FROM chats 
            WHERE conversation_id = ANY($1::text[])
        `, convIds);
        
        const existingChatConvs = new Set(chatsForTheseConvs.map(c => c.conversation_id));
        let messagesWithChat = 0;
        let messagesWithoutChat = nullOrEmptyCount;

        for (const g of groupByConv) {
            if (g.conversation_id && existingChatConvs.has(g.conversation_id)) {
                messagesWithChat += Number(g.count);
            } else if (g.conversation_id) {
                messagesWithoutChat += Number(g.count);
            }
        }

        console.log(`Chats found in 'chats' table: ${chatsForTheseConvs.length} out of ${convIds.length}`);
        console.log(`Messages linked to an existing chat: ${messagesWithChat}`);
        console.log(`Messages NOT linked to an existing chat (orphan or null conv_id): ${messagesWithoutChat}`);

    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        await prisma.$disconnect();
    }
}
main();
