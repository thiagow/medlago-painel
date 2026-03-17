const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findFirst();
    const dept = await prisma.department.findFirst();
    await prisma.userDepartment.create({
      data: {
        user_id: user.id,
        department_id: dept.id,
      }
    });
  } catch (e) {
    fs.writeFileSync('prisma-error-full.txt', JSON.stringify({
        message: e.message,
        code: e.code,
        meta: e.meta,
        stack: e.stack
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main();
