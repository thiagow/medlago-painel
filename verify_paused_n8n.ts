import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const pausedChats = await prisma.chat.findMany({
    where: {
      ai_service: 'paused',
      finished: false,
    },
    orderBy: { updated_at: 'desc' },
    select: {
      id: true, phone: true, status: true, created_at: true, updated_at: true, assigned_to: true
    }
  })
  
  const transferLogs = await prisma.chatTransferLog.findMany({
    where: { chat_id: { in: pausedChats.map(c => c.id) } },
    select: { chat_id: true, transfer_type: true, external_contact_id: true }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logsByChat = new Map<string, any[]>();
  for (const log of transferLogs) {
      const cid = log.chat_id.toString();
      if (!logsByChat.has(cid)) logsByChat.set(cid, []);
      logsByChat.get(cid)!.push(log);
  }

  const result = pausedChats.map(c => ({
      id: c.id.toString(),
      phone: c.phone,
      status: c.status,
      assigned_to: c.assigned_to?.toString(),
      updated_at: c.updated_at,
      logs: logsByChat.get(c.id.toString()) || []
  }));

  const actuallyExternal = result.filter(r => r.logs.some(l => l.transfer_type === 'external'));

  console.log("Total paused not finished:", result.length);
  console.log("Of which have 'external' transfer type logs:", actuallyExternal.length);
  console.log("Chats to fix:", JSON.stringify(actuallyExternal, null, 2));
}

main().catch(e => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
