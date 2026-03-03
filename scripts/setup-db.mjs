/**
 * Script de setup do banco de dados usando node-postgres diretamente
 * Ignora SSL para compatibilidade com o servidor
 * 
 * Uso: node scripts/setup-db.mjs
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const pg = require("pg");
const { Client } = pg;

// Lê o .env manualmente
import { readFileSync } from "fs";
const envContent = readFileSync(".env", "utf-8");
const envVars = Object.fromEntries(
    envContent
        .split("\n")
        .filter((line) => line.includes("=") && !line.startsWith("#"))
        .map((line) => {
            const [key, ...rest] = line.split("=");
            return [key.trim(), rest.join("=").replace(/^"(.*)"$/, "$1").trim()];
        })
);

// Decodifica a URL e desativa SSL
const databaseUrl = decodeURIComponent(envVars.DATABASE_URL || "");
const urlWithSsl = databaseUrl.includes("?")
    ? databaseUrl.replace("?sslmode=disable", "") + "?sslmode=disable"
    : databaseUrl + "?sslmode=disable";

const client = new Client({
    connectionString: databaseUrl.replace("?sslmode=disable", "").replace("?sslmode=require", ""),
    ssl: false,
});

async function setup() {
    try {
        console.log("🔄 Conectando ao banco de dados...");
        await client.connect();
        console.log("✅ Conectado com sucesso!\n");

        // Criar tabela de roles
        await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
        console.log("✅ Tabela 'roles' criada/verificada");

        await client.query(`
      INSERT INTO roles (name, description) VALUES
        ('admin', 'Acesso total ao sistema'),
        ('atendente', 'Acesso ao painel de atendimento')
      ON CONFLICT (name) DO NOTHING;
    `);
        console.log("✅ Perfis inseridos");

        // Criar tabela de users
        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'atendente',
        active BOOLEAN DEFAULT TRUE,
        must_change_password BOOLEAN DEFAULT FALSE
      );
    `);
        console.log("✅ Tabela 'users' criada/verificada");

        await client.query(`CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);`);

        // Hash de MedLago@2024 com bcrypt rounds=10
        const bcrypt = require("bcryptjs");
        const hash = await bcrypt.hash("MedLago@2024", 12);

        await client.query(`
      INSERT INTO users (name, email, password_hash, role, active, must_change_password)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO NOTHING;
    `, ["Administrador", "admin@medlago.com", hash, "admin", true, true]);
        console.log("✅ Usuário admin criado");

        console.log("\n🎉 Setup concluído com sucesso!");
        console.log("   Email: admin@medlago.com");
        console.log("   Senha: MedLago@2024");
        console.log("   ⚠️  TROQUE A SENHA NO PRIMEIRO ACESSO!\n");
    } catch (error) {
        console.error("❌ Erro no setup:", error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

setup();
