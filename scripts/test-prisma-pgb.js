const { PrismaClient } = require("@prisma/client");
process.env.DATABASE_URL = "postgresql://user_medlago_app:TquARTN45f9Ku5f@44.196.25.76:5436/medlago?pgbouncer=true&sslmode=disable";
const prisma = new PrismaClient();

async function test() {
    try {
        const users = await prisma.user.findMany({ take: 1 });
        console.log("Prisma Success with pgbouncer=true!", users.length);
    } catch (e) {
        console.log("EXACT ERROR MESSAGE:\n" + e.message);
    } finally {
        await prisma.$disconnect();
    }
}
test();
