import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const where: any = {};
    const skip = 0;
    const limit = 50;

    const [chats, total] = await Promise.all([
        prisma.chat.findMany({
            where,
            orderBy: { updated_at: "desc" },
            skip,
            take: limit,
        }),
        prisma.chat.count({ where }),
    ]);

    console.log(`Total chats count: ${total}`);
    console.log(`Chats returned: ${chats.length}`);
}

main().catch(e => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
