const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Buscando pacientes por nome ---');
  const patients = await prisma.paciente.findMany({
    where: {
      nome: {
        contains: 'Thiago',
        mode: 'insensitive'
      }
    },
    select: {
      id: true,
      nome: true,
      telefone_principal: true,
      cpf: true
    }
  });

  console.log(`Encontrados ${patients.length} pacientes.`);
  patients.forEach(p => {
    console.log(`ID: ${p.id} | Nome: ${p.nome} | Telefone: ${p.telefone_principal}`);
  });

  console.log('\n--- Buscando pacientes por Cooperx ---');
  const patients2 = await prisma.paciente.findMany({
    where: {
      nome: {
        contains: 'Cooperx',
        mode: 'insensitive'
      }
    }
  });
  console.log(`Encontrados ${patients2.length} pacientes por Cooperx.`);
  patients2.forEach(p => {
    console.log(`ID: ${p.id} | Nome: ${p.nome} | Telefone: ${p.telefone_principal}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
