const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const p = new PrismaClient();

async function main() {
    let out = "";
    const tables = ["pacientes", "profissionais", "tipos_atendimento", "convenios"];
    for (const t of tables) {
        const cols = await p.$queryRawUnsafe(
            `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${t}' ORDER BY ordinal_position`
        );
        out += `\n=== ${t} ===\n`;
        for (const c of cols) out += c.column_name + " | " + c.data_type + "\n";
    }
    fs.writeFileSync("tmp/related_tables.txt", out, "utf8");
    console.log("OK");
}
main().catch(console.error).finally(() => p.$disconnect());
