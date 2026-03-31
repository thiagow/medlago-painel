const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSearch(phone) {
  console.log(`--- Testando busca para: ${phone} ---`);
  const normalizedPhone = phone.replace(/\D/g, "");
  console.log(`Telefone normalizado (input): ${normalizedPhone}`);

  const variations = new Set();
  variations.add(normalizedPhone);
  variations.add(normalizedPhone.replace(/^55/, ""));
  
  const phoneNoDDI = normalizedPhone.replace(/^55/, "");
  if (phoneNoDDI.length === 10) {
    const with9 = phoneNoDDI.substring(0, 2) + "9" + phoneNoDDI.substring(2);
    variations.add(with9);
    variations.add("55" + with9);
  } else if (phoneNoDDI.length === 11 && phoneNoDDI[2] === "9") {
    const without9 = phoneNoDDI.substring(0, 2) + phoneNoDDI.substring(3);
    variations.add(without9);
    variations.add("55" + without9);
  }
  
  const searchTerms = Array.from(variations);
  console.log('Search terms:', searchTerms);

  const query = `
    SELECT id, nome, telefone_principal, 
    regexp_replace(telefone_principal, '[^0-9]', '', 'g') as tel_clean
    FROM "pacientes" 
    WHERE regexp_replace(telefone_principal, '[^0-9]', '', 'g') IN (${searchTerms.map(t => `'${t}'`).join(',')})
    LIMIT 5
  `;
  
  console.log('Query:', query);
  
  try {
    const results = await prisma.$queryRawUnsafe(query);
    console.log('Resultados:', JSON.stringify(results, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value, 2));
  } catch (err) {
    console.error('Erro na query:', err);
  }
}

// Testar com o telefone que o usuário informou
testSearch("556291785173")
  .then(() => testSearch("6291785173"))
  .then(() => testSearch("5562991785173"))
  .finally(() => prisma.$disconnect());
