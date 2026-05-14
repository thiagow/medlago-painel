# Template: Nova Rota de API

Checklist para criar uma nova rota em `src/app/api/[recurso]/route.ts` ou `src/app/api/[recurso]/[id]/route.ts`.

---

## Estrutura Base

```typescript
// src/app/api/[recurso]/[id]/route.ts
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // 1. Extrair usuário de headers (injetados por middleware)
    const userId = req.headers.get('x-user-id');
    const userRole = req.headers.get('x-user-role');
    if (!userId) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    // 2. RBAC: verificar permissão específica se necessário
    if (userRole !== 'admin') {
      return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // 3. Validar params
    const { id } = params;
    if (!id || typeof id !== 'string') {
      return Response.json({ success: false, error: 'Invalid ID' }, { status: 400 });
    }

    // 4. Query Prisma
    const record = await prisma.recurso.findUnique({ where: { id } });
    if (!record) {
      return Response.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    // 5. Resposta padrão
    return Response.json({ success: true, data: record });
  } catch (error) {
    console.error('[API]', error);
    return Response.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();

    // 6. Validar corpo (se complexo, considerar zod)
    if (!body.name || typeof body.name !== 'string') {
      return Response.json({ success: false, error: 'Missing name' }, { status: 400 });
    }

    const record = await prisma.recurso.update({
      where: { id: params.id },
      data: { name: body.name, updated_at: new Date() },
    });

    return Response.json({ success: true, data: record });
  } catch (error) {
    console.error('[API]', error);
    return Response.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = req.headers.get('x-user-id');
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'admin') {
    return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  // 7. Soft delete se aplicável: update deleted_at em vez de remover
  await prisma.recurso.update({
    where: { id: params.id },
    data: { deleted_at: new Date() },
  });

  return Response.json({ success: true });
}
```

---

## Checklist de Segurança

- [ ] Header `x-user-id` extraído e validado (não pode ser falso)
- [ ] RBAC verificado para operações `PUT`, `DELETE` (apenas admin?)
- [ ] Input validado (type, length, format)
- [ ] Soft delete usado se necessário (nunca `deleteMany` direto)
- [ ] Erros não vazam detalhes internos (generic "Internal error")
- [ ] `created_at`/`updated_at` preenchidos em updates
- [ ] Transação Prisma se múltiplas writes (`.transaction()`)
- [ ] Rate-limiting considerado para operações caras

---

## Checklist de Performance

- [ ] Query seleciona apenas campos necessários (`.select({ id, name })`)
- [ ] Joins evitados se dados vêm de múltiplas rotas (N+1 queries)
- [ ] Paginação implementada se lista pode ser grande (`.skip().take()`)
- [ ] Caching de read-heavy (headers `Cache-Control` se apropriado)

---

## Checklist de Tipos TypeScript

- [ ] Params com type explícito (`{ params: { id: string } }`)
- [ ] Response com type (usa `Response.json()`, nunca bare object)
- [ ] Body com interface se complexo (ou zod/typescript para validação)

---

## Validação com Zod (Opcional)

Se validação for complexa:

```typescript
import { z } from 'zod';

const CreateRecursoSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  agendamento_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  
  try {
    const validated = CreateRecursoSchema.parse(body);
    // ... prosseguir com validated
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ success: false, error: error.issues[0].message }, { status: 400 });
    }
    throw error;
  }
}
```

---

## Padrão: Collection List (GET sem ID)

```typescript
export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  // Paginação
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '20'), 100);
  const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0');

  const [records, total] = await Promise.all([
    prisma.recurso.findMany({
      where: { deleted_at: null }, // soft delete filter
      skip: offset,
      take: limit,
      orderBy: { created_at: 'desc' },
    }),
    prisma.recurso.count({ where: { deleted_at: null } }),
  ]);

  return Response.json({
    success: true,
    data: records,
    pagination: { limit, offset, total },
  });
}
```

---

## Padrão: Bulk Update/Delete

```typescript
export async function PATCH(req: NextRequest) {
  const userRole = req.headers.get('x-user-role');
  if (userRole !== 'admin') {
    return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { ids, status } = body; // ids: string[], status: 'ativo' | 'inativo'

  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ success: false, error: 'Empty ids' }, { status: 400 });
  }

  const updated = await prisma.recurso.updateMany({
    where: { id: { in: ids } },
    data: { status, updated_at: new Date() },
  });

  return Response.json({ success: true, data: { updated: updated.count } });
}
```

---

## Quando Usar Transações

```typescript
await prisma.$transaction(async (tx) => {
  const agendamento = await tx.agendamento.update({
    where: { id },
    data: { status: 'cancelado', motivo, updated_at: new Date() },
  });

  await tx.broadcast.updateMany({
    where: { agendamento_id: id },
    data: { status: 'cancelled' },
  });

  return agendamento;
});
```

Use quando múltiplas writes precisam ser atômicas (tudo ou nada).

---

## Logging Recomendado

```typescript
console.log(`[${new Date().toISOString()}] GET /api/recurso/${params.id} by ${userId}`);
```

Não logar:
- Senhas, tokens, dados PII (compliance LGPD)
- Objetos grandes (logs fica ilegível)
