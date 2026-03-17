import { prisma } from './src/lib/prisma';

async function test() {
  try {
    const dept = await prisma.department.create({
      data: {
        name: `Teste Isolado ${Date.now()}`,
        description: 'Se funcionar aqui, o problema é o cache do Next.js dev server',
      }
    });
    console.log("SUCESSO:", dept);
    await prisma.department.delete({ where: { id: dept.id } });
  } catch (err) {
    console.error("ERRO:", err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
