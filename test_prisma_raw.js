const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

async function testQueryRaw() {
  const searchTerms = ['556291785173', '6291785173', '62991785173', '5562991785173'];
  console.log('Search terms:', searchTerms);

  try {
     // Simulando exatamente o que está no arquivo route.ts
     const results = await prisma.$queryRaw`
            SELECT id, nome, telefone_principal 
            FROM "pacientes" 
            WHERE regexp_replace(telefone_principal, '[^0-9]', '', 'g') IN (${Prisma.join(searchTerms)})
            LIMIT 1
        `;
    console.log('Resultados:', JSON.stringify(results, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value, 2));
  } catch (err) {
    console.error('Erro na query:', err);
  }
}

testQueryRaw().finally(() => prisma.$disconnect());
