import { prisma } from "./src/lib/prisma";

async function main() {
    const chats = await prisma.chat.findMany({
        select: {
            id: true,
            phone: true,
            created_at: true,
            finished: true,
            ai_service: true
        },
        orderBy: { created_at: 'desc' }
    });

    console.log(`Total chats: ${chats.length}`);
    const finishedCount = chats.filter(c => c.finished === true).length;
    console.log(`Finished chats: ${finishedCount}`);

    const finishedChats = chats.filter(c => c.finished === true);
    console.log("Finished chats details:");
    finishedChats.forEach(c => {
        console.log(`ID: ${c.id}, Phone: ${c.phone}, Created: ${c.created_at}, AI: ${c.ai_service}`);
    });

    const last15 = chats.slice(-15);
    console.log("Last 15 chats (oldest):");
    last15.forEach(c => {
        if (c.finished) console.log(`[FINISHED] ID: ${c.id}, Created: ${c.created_at}`);
    });
}

main().catch(console.error);
