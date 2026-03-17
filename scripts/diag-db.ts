import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('--- DIAGNÓSTICO DE BANCO DE DADOS ---');
    
    // 1. Verificar Usuário e Banco Atual
    const connInfo: any[] = await prisma.$queryRaw`SELECT current_user, current_database(), session_user`;
    console.log('Conexão Atual:', connInfo[0]);

    // 2. Verificar Tabelas e Sequences (Schema public)
    const objects: any[] = await prisma.$queryRaw`
      SELECT 
        n.nspname as schema, 
        c.relname as objeto, 
        c.relkind as tipo,
        pg_get_userbyid(c.relowner) as dono
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname IN ('departments', 'departments_id_seq', 'external_contacts', 'external_contacts_id_seq')
      OR (n.nspname = 'public' AND c.relkind = 'S')
    `;
    console.log('Objetos Encontrados:', JSON.stringify(objects, null, 2));

    // 3. Testar a sequence especificamente
    try {
      const seqVal: any[] = await prisma.$queryRaw`SELECT nextval('departments_id_seq')`;
      console.log('Sucesso ao incrementar sequence (departments):', seqVal[0]);
    } catch (e: any) {
      console.error('Falha ao incrementar sequence (departments):', e.message);
    }

  } catch (error) {
    console.error('Erro no diagnóstico:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
