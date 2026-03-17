const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    const r = await prisma.$queryRawUnsafe('SELECT current_user');
    const u = r[0].current_user;
    const s = await prisma.$queryRawUnsafe("SELECT pg_get_userbyid(relowner) as dono FROM pg_class WHERE relname='departments_id_seq'");
    const d = s[0].dono;
    console.log(`CURRENT_USER: ${u}`);
    console.log(`OWNER: ${d}`);
    if (u === d) {
       console.log('User IS owner. Checking usage...');
       try { await prisma.$queryRawUnsafe("SELECT nextval('departments_id_seq')"); console.log('NEXTVAL SUCCESS'); }
       catch(e) { console.log('NEXTVAL FAIL:', e.message); }
    } else {
       console.log(`User ${u} is NOT owner (Owner is ${d})`);
    }
  } catch (e) { console.log('ERR:', e.message); }
  finally { await prisma.$disconnect(); }
}
main();
