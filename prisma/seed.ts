import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Iniciando seed do banco de dados...");

    // Criar perfis
    await prisma.role.upsert({
        where: { name: "admin" },
        update: {},
        create: {
            name: "admin",
            description: "Acesso total ao sistema",
        },
    });

    await prisma.role.upsert({
        where: { name: "atendente" },
        update: {},
        create: {
            name: "atendente",
            description: "Acesso ao painel de atendimento",
        },
    });

    console.log("✅ Perfis criados");

    // Criar usuário admin padrão
    const adminPassword = await bcrypt.hash("MedLago@2024", 12);

    await prisma.user.upsert({
        where: { email: "admin@medlago.com" },
        update: {
            password_hash: adminPassword,
            must_change_password: false,
        },
        create: {
            name: "Administrador",
            email: "admin@medlago.com",
            password_hash: adminPassword,
            role: "admin",
            active: true,
            must_change_password: false,
        },
    });

    console.log("✅ Usuário admin criado");
    console.log("   Email: admin@medlago.com");
    console.log("   Senha: MedLago@2024");
    console.log("   ⚠️  Troque a senha no primeiro acesso!");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
