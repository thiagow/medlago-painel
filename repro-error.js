const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Pegar o primeiro usuário e o primeiro departamento para testar
    const user = await prisma.user.findFirst();
    const dept = await prisma.department.findFirst();

    if (!user || !dept) {
      console.log("User or Dept not found. User:", !!user, "Dept:", !!dept);
      return;
    }

    console.log(`Testing link: User ${user.id} -> Dept ${dept.id}`);

    const link = await prisma.userDepartment.create({
      data: {
        user_id: user.id,
        department_id: dept.id,
      }
    });

    console.log("Success!", link);
  } catch (e) {
    console.error("FAILED with error:");
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
