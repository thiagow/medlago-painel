const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const fs = require('fs');
async function main() {
  const all = await p.$queryRawUnsafe(`
    SELECT id::text, phone, conversation_id, ai_service, 
           finished::text, assigned_to::text,
           created_at::text, updated_at::text
    FROM chats
    WHERE phone LIKE '%61%9868%9633%'
       OR phone LIKE '%619868%'
    ORDER BY id
  `);
  fs.writeFileSync('tmp/all_chats_9633.json', JSON.stringify(all, null, 2), 'utf8');
  all.forEach(c => console.log(`ID:${c.id} phone:"${c.phone}" ai_service:${c.ai_service} finished:${c.finished}`));
  await p.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
