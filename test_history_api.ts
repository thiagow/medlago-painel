import { prisma } from "./src/lib/prisma";

async function main() {
    console.log("--- Testing History API Logic ---");
    
    // Case 1: No filters (like default page load)
    const allChats = await prisma.chat.findMany({
        orderBy: { created_at: "desc" },
        take: 10
    });
    console.log(`Default (no filters) returns ${allChats.length} chats.`);
    const finishedInDefault = allChats.filter(c => c.finished).length;
    console.log(`Finished chats in default result: ${finishedInDefault}`);

    // Case 2: status="finished"
    const finishedChats = await prisma.chat.findMany({
        where: { finished: true },
        orderBy: { created_at: "desc" },
        take: 10
    });
    console.log(`Status="finished" returns ${finishedChats.length} chats.`);
    finishedChats.forEach(c => console.log(`ID: ${c.id}, Phone: ${c.phone}, Finished: ${c.finished}`));

    // Case 3: status="active"
    const activeChats = await prisma.chat.findMany({
        where: { ai_service: "active", finished: false },
        orderBy: { created_at: "desc" },
        take: 10
    });
    console.log(`Status="active" returns ${activeChats.length} chats.`);
}

main().catch(console.error);
