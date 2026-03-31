const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkChat() {
  console.log('--- Buscando chat por telefone ---');
  const chats = await prisma.chat.findMany({
    where: {
      phone: {
        contains: '91785173'
      }
    }
  });

  console.log(`Encontrados ${chats.length} chats.`);
  chats.forEach(c => {
    console.log(`ID: ${c.id} | Phone: ${c.phone} | ConversationID: ${c.conversation_id}`);
  });
}

checkChat().finally(() => prisma.$disconnect());
