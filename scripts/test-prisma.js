const { PrismaClient } = require("@prisma/client");

const urls = [
    "postgresql://user_medlago_app:TquARTN45f9Ku5f@44.196.25.76:5436/medlago?sslmode=disable",
    "postgresql://user_medlago_app:TquARTN45f9Ku5f@44.196.25.76:5436/medlago?schema=public&sslmode=disable",
    "postgresql://user_medlago_app:TquARTN45f9Ku5f@44.196.25.76:5436/postgres?sslmode=disable"
];

async function testUrl(url) {
    console.log("Testing:", url);
    process.env.DATABASE_URL = url;
    const prisma = new PrismaClient();
    try {
        const res = await prisma.$queryRaw`SELECT 1`;
        console.log("SUCCESS");
    } catch (e) {
        console.log("FAIL:", e.message.split("\n").find(l => l.includes("FATAL") || l.includes("Error")));
    } finally {
        await prisma.$disconnect();
    }
}

async function run() {
    for (const u of urls) await testUrl(u);
}
run();
