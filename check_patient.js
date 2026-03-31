const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const phone = "6291785173"; // Original numeric digits without country code
    const phoneWithDDI = "556291785173";
    
    console.log("Searching for patients with phone variations...");
    const patients = await prisma.paciente.findMany({
        where: {
            OR: [
                { telefone_principal: { contains: "9178" } },
                { telefone_principal: { contains: "5173" } },
                { nome: { contains: "Thiago", mode: 'insensitive' } }
            ]
        }
    });
    
    console.log(JSON.stringify(patients, (key, value) =>
        typeof value === 'bigint'
            ? value.toString()
            : value
    , 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
