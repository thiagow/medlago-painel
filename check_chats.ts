import { prisma } from "./src/lib/prisma";

async function main() {
    const total = await prisma.chat.count();
    const finished = await prisma.chat.count({ where: { finished: true } });
    const unfinished = await prisma.chat.count({ where: { finished: false } });
    const nullFinished = await prisma.chat.count({ where: { finished: null } });
    
    console.log({
        total,
        finished,
        unfinished,
        nullFinished
    });

    const recentFinished = await prisma.chat.findMany({
        where: { finished: true },
        take: 5,
        orderBy: { updated_at: 'desc' }
    });
    
    console.log("Recent Finished Chats:", JSON.stringify(recentFinished, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value
    , 2));
}

main().catch(console.error);
