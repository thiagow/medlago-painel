const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Searching for 'Thiago Cooperx' or phone '91785173'...");
    const patients = await prisma.paciente.findMany({
        where: {
            OR: [
                { nome: { contains: "Thiago", mode: 'insensitive' } },
                { telefone_principal: { contains: "9178" } }
            ]
        }
    });
    
    patients.forEach(p => {
        console.log("--- Patient Found ---");
        console.log("ID:", p.id.toString());
        console.log("Nome:", p.nome);
        console.log("Telefone:", p.telefone_principal);
        console.log("--------------------");
    });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
