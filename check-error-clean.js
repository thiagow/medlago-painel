const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findFirst();
    const dept = await prisma.department.findFirst();
    if (!user || !dept) {
        console.log("Error: User or Dept not found");
        return;
    }
    await prisma.userDepartment.create({
      data: {
        user_id: user.id,
        department_id: dept.id,
      }
    });
    console.log("SUCCESS");
  } catch (e) {
    console.log("--- ERROR INFO ---");
    console.log("Code:", e.code);
    console.log("Message:", e.message);
    if (e.meta) {
      console.log("Meta:", JSON.stringify(e.meta, null, 2));
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
