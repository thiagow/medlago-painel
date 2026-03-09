// scripts/create-table.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    try {
        console.log("Criando tabela chat_transfer_logs manualmente...");

        await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "public"."chat_transfer_logs" (
        "id" BIGSERIAL PRIMARY KEY,
        "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "chat_id" BIGINT NOT NULL,
        "user_name" TEXT NOT NULL,
        "reason" TEXT NOT NULL,
        "summary" TEXT NOT NULL
      );
    `);

        console.log("Tabela criada com sucesso!");
    } catch (error) {
        console.error("Erro ao criar tabela:", error);
    } finally {
        await prisma.$disconnect()
    }
}

main()
