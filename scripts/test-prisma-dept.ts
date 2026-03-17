import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const dept = await prisma.department.create({
      data: {
        name: 'Departamento Teste Manual',
        description: 'Via script PrismaClient',
      },
    })
    console.log("Sucesso:", dept)
  } catch (e) {
    console.error("ERRO PRISMA:", e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
