const { Client } = require("pg");

// URL base extraída do .env
const rawUrl = "postgresql://user_medlago_app:TquARTN45f9Ku5f@44.196.25.76:5432/medlago";

async function testConnection(sslOption) {
    console.log(`\n--- Testando com configuração SSL: ${JSON.stringify(sslOption)} ---`);

    const client = new Client({
        connectionString: rawUrl,
        ssl: sslOption
    });

    try {
        await client.connect();
        console.log("✅ CONNECTED SUCCESSFULLY");
        const res = await client.query("SELECT version()");
        console.log("DB Version:", res.rows[0].version);
        await client.end();
        return true;
    } catch (e) {
        console.log("❌ FAILED:", e.message);
        // Tenta imprimir o código de erro do Postgres, se aplicável
        if (e.code) console.log("   Postgres Code:", e.code);
        return false;
    }
}

async function main() {
    console.log("Iniciando testes de conexão com as credenciais via módulo pg (nativo)...");
    console.log("User: user_medlago_app");
    console.log("Endereço: 44.196.25.76:5432");

    const options = [
        false,                         // sslmode=disable
        { rejectUnauthorized: false }, // sslmode=no-verify
        true                           // sslmode=require
    ];

    for (const opt of options) {
        const success = await testConnection(opt);
        if (success) {
            console.log("\n=> Conexão estabelecida! O problema é apenas na configuração do SSL.");
            return;
        }
    }

    console.log("\n=> Nenhuma tentativa de SSL funcionou. O PostgreSQL continua rejeitando a senha para este usuário vindo deste IP.");
}

main();
