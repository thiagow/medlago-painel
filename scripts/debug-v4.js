const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log('--- DEB BUG V4 ---');
  try {
    const r = await prisma.$queryRawUnsafe('SELECT current_user');
    console.log('USER:', r[0].current_user);
    const s = await prisma.$queryRawUnsafe("SELECT relname, pg_get_userbyid(relowner) FROM pg_class WHERE relname='departments_id_seq'");
    console.log('OBJ:', JSON.stringify(s));
    const n = await prisma.$queryRawUnsafe("SELECT nextval('departments_id_seq')");
    console.log('VAL:', n[0].nextval);
  } catch (e) { console.log('ERR:', e.message); }
  finally { await prisma.$disconnect(); }
}
main();
