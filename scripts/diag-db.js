const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('--- DIAGNÓSTICO DE BANCO DE DADOS ---');
    
    // 1. Verificar Usuário e Banco Atual
    try {
      const connInfo = await prisma.$queryRawUnsafe('SELECT current_user, current_database(), session_user');
      console.log('Conexão Atual:', connInfo[0]);
    } catch (e) {
      console.error('Erro ao pegar info da conexão:', e.message);
    }

    // 2. Verificar Tabelas e Sequences (Schema public)
    try {
      const objects = await prisma.$queryRawUnsafe(`
        SELECT 
          n.nspname as schema, 
          c.relname as objeto, 
          c.relkind as tipo,
          pg_get_userbyid(c.relowner) as dono
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname IN ('departments', 'departments_id_seq', 'external_contacts', 'external_contacts_id_seq')
      `);
      console.log('Objetos Encontrados:', JSON.stringify(objects, null, 2));
    } catch (e) {
      console.error('Erro ao verificar objetos:', e.message);
    }

    // 3. Testar a sequence especificamente
    try {
      const seqVal = await prisma.$queryRawUnsafe("SELECT nextval('departments_id_seq')");
      console.log('Sucesso ao incrementar sequence (departments):', seqVal[0]);
    } catch (e) {
      console.log('FALHA ESPERADA na sequence (departments):', e.message);
    }

  } catch (error) {
    console.error('Erro no diagnóstico:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
