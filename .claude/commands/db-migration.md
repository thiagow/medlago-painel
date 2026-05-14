# Checklist: Database Migration

Procedimento para adicionar/alterar campos no schema PostgreSQL.

---

## 1. Editar Schema

Arquivo: `prisma/schema.prisma`

```prisma
model Recurso {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique  // novo campo
  status    String   @default("ativo")
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@index([status])
}
```

**Convenções:**
- IDs são `String @id @default(cuid())` ou `@default(uuid())`
- Timestamps: `created_at DateTime @default(now())`, `updated_at DateTime @updatedAt`
- Soft delete: `deleted_at DateTime?` (nullable)
- Enums: `enum Status { ATIVO INATIVO }` e referência como `status Status`
- Índices: `@@index([field])` para queries frequentes, `@@unique([field])` para unicidade

---

## 2. Gerar SQL Manual

Não use `prisma migrate dev`. Crie arquivo SQL em `prisma/migrations/`:

**Nomeação:** `YYYYMMDDHHMMSS_descricao_curta.sql`

Exemplo: `20240514103045_add_email_to_recursos.sql`

```sql
-- AddColumn email to Recurso
ALTER TABLE "Recurso" ADD COLUMN "email" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Recurso" ADD CONSTRAINT "Recurso_email_key" UNIQUE ("email");

-- CreateIndex
CREATE INDEX "Recurso_status_idx" ON "Recurso"("status");

-- Update existing rows if needed
UPDATE "Recurso" SET "email" = CONCAT(id, '@exemplo.com') WHERE email = '';

-- Remove default after backfill (optional)
-- ALTER TABLE "Recurso" ALTER COLUMN "email" DROP DEFAULT;
```

**Padrão PostgreSQL:**
- Table/column names entre aspas (case-sensitive)
- `TEXT` para strings
- `BIGINT` para números grandes
- `BOOLEAN` para booleanos
- `TIMESTAMP` para datas
- `JSONB` para dados semi-estruturados
- `UUID` gerado com `gen_random_uuid()`

---

## 3. Validar SQL

Antes de executar:

```bash
# No psql ou DBeaver:
-- Copy-paste o SQL manualmente e teste em ambiente local
\d "Recurso"  -- describe table

-- Ou use Prisma Studio:
npx prisma studio  # visual browser
```

---

## 4. Registrar Migração

```bash
# Diga ao Prisma que essa migração já foi aplicada (se rodou manual)
npx prisma migrate resolve --applied --name add_email_to_recursos

# Ou, se ainda não rodou:
npx prisma migrate deploy
```

---

## 5. Atualizar Tipos

```bash
npx prisma generate
```

Isso regenera `node_modules/@prisma/client` com os novos tipos.

---

## 6. Criar Seed (se Inicial)

Arquivo: `prisma/seed.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed data
  const recurso = await prisma.recurso.create({
    data: {
      id: 'recurso_1',
      name: 'Exemplo',
      email: 'exemplo@clinica.com',
      status: 'ativo',
    },
  });

  console.log('Seeded:', recurso);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Executar:
```bash
npx prisma db seed
```

---

## Casos Comuns

### Adicionar Campo Obrigatório

```sql
-- Se tabela tem dados, use DEFAULT temporário
ALTER TABLE "Recurso" ADD COLUMN "phone" TEXT NOT NULL DEFAULT '000-0000';

-- Depois backfill
UPDATE "Recurso" SET "phone" = ... WHERE phone = '000-0000';

-- Remove default
ALTER TABLE "Recurso" ALTER COLUMN "phone" DROP DEFAULT;
```

### Adicionar Enum

```prisma
enum AgendamentoStatus {
  agendado
  realizado
  cancelado
  pendente_confirmacao
}

model Agendamento {
  status AgendamentoStatus @default(agendado)
  motivo String? // obrigatório se status = cancelado ou pendente
}
```

SQL:
```sql
CREATE TYPE "AgendamentoStatus" AS ENUM ('agendado', 'realizado', 'cancelado', 'pendente_confirmacao');
ALTER TABLE "Agendamento" ADD COLUMN "status" "AgendamentoStatus" NOT NULL DEFAULT 'agendado';
```

### Relacionamentos

```prisma
model Chat {
  id String @id @default(cuid())
  messages ChatMessage[]
  tags ChatTag[]
}

model ChatMessage {
  id String @id @default(cuid())
  chat_id String
  chat Chat @relation(fields: [chat_id], references: [id], onDelete: Cascade)

  @@index([chat_id])
}
```

SQL:
```sql
ALTER TABLE "ChatMessage" ADD COLUMN "chat_id" TEXT NOT NULL;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_chat_id_fkey" 
  FOREIGN KEY ("chat_id") REFERENCES "Chat"("id") ON DELETE CASCADE;
CREATE INDEX "ChatMessage_chat_id_idx" ON "ChatMessage"("chat_id");
```

### Soft Delete

```prisma
model Recurso {
  deleted_at DateTime? // null = ativo, not null = deletado
}
```

SQL:
```sql
ALTER TABLE "Recurso" ADD COLUMN "deleted_at" TIMESTAMP;
```

Query de leitura sempre filtra:
```typescript
prisma.recurso.findMany({
  where: { deleted_at: null },
});
```

---

## Rollback (Se Necessário)

Se migração foi errada:

1. **Desenvolvimento local:** delete `.sql` não committed e refaça
2. **Staging/Prod:** crie SQL reverso

```sql
-- 20240514103046_revert_add_email_to_recursos.sql
ALTER TABLE "Recurso" DROP CONSTRAINT "Recurso_email_key";
ALTER TABLE "Recurso" DROP COLUMN "email";
DROP INDEX "Recurso_status_idx";
```

Depois:
```bash
npx prisma migrate resolve --rolled-back --name add_email_to_recursos
```

---

## Checklist Pré-Commit

- [ ] SQL testado em ambiente local
- [ ] Arquivo `.sql` com timestamp + descrição clara
- [ ] `schema.prisma` atualizado
- [ ] `npx prisma generate` rodado
- [ ] Se backfill: UPDATE queries testadas
- [ ] Seed atualizado (se aplicável)
- [ ] Nenhum `prisma migrate dev` auto-gerado
- [ ] Índices adicionados para queries frequentes

---

## Recursos Úteis

- Prisma Docs: https://www.prisma.io/docs/orm/prisma-schema
- PostgreSQL Types: https://www.postgresql.org/docs/current/datatype.html
- Prisma Studio: `npx prisma studio`
- Check migrations: `prisma migrate status`
