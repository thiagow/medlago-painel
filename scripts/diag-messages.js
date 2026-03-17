const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const pausedChats = await prisma.$queryRawUnsafe(`
        SELECT id, phone, ai_service 
        FROM chats 
        WHERE ai_service = 'paused' 
        LIMIT 3
    `);
    
    console.log('=== CHATS PAUSADOS (Aba Humano) ===');
    console.log(JSON.stringify(pausedChats, (k,v) => typeof v === 'bigint' ? v.toString() : v, 2));
    
    if (pausedChats.length === 0) {
        console.log('Nenhum chat pausado encontrado');
        return;
    }
    
    const phone = pausedChats[0].phone;
    console.log(`\nTelefone analisado: ${phone}`);
    
    const stats = await prisma.$queryRawUnsafe(`
        SELECT 
            COUNT(*)::int as total,
            COUNT(user_message)::int as with_user_msg,
            COUNT(bot_message)::int as with_bot_msg,
            SUM(CASE WHEN user_message IS NOT NULL AND bot_message IS NOT NULL THEN 1 ELSE 0 END)::int as with_both,
            SUM(CASE WHEN user_message IS NOT NULL AND bot_message IS NULL THEN 1 ELSE 0 END)::int as user_only,
            SUM(CASE WHEN bot_message IS NOT NULL AND user_message IS NULL THEN 1 ELSE 0 END)::int as bot_only
        FROM chat_messages 
        WHERE phone = $1
    `, phone);
    
    console.log('\n=== ESTATÍSTICAS ===');
    console.log(JSON.stringify(stats, null, 2));
    
    // Amostra dos que tem ambos
    const bothSample = await prisma.$queryRawUnsafe(`
        SELECT id, 
               LEFT(user_message, 40) as user_msg,
               LEFT(bot_message, 40) as bot_msg
        FROM chat_messages 
        WHERE phone = $1 AND user_message IS NOT NULL AND bot_message IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 5
    `, phone);
    
    console.log('\n=== AMOSTRA com AMBOS campos preenchidos ===');
    console.log(JSON.stringify(bothSample, (k,v) => typeof v === 'bigint' ? v.toString() : v, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
