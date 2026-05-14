# Documentação — MedLago App

Esta pasta contém documentação para o agente Claude Code e para o time de desenvolvimento. Leia antes de fazer mudanças estruturais.

## Índice

### Para Agentes (Claude Code)

Estes documentos são **lidos automaticamente** em cada sessão:

- **[CLAUDE.md](/CLAUDE.md)** (raiz) — instruções do agente: stack, arquitetura, padrões, convenções
- **[docs/DOMAIN.md](DOMAIN.md)** — glossário de domínio: entidades, fluxos de negócio, regras críticas
- **[docs/ARCHITECTURE.md](ARCHITECTURE.md)** — decisões arquiteturais com raciocínio (por que JWT customizado, por que sem Redux, etc.)

### Para Operações Comuns

Templates e checklists em **`.claude/commands/`** (leia antes de construir):

- **[new-api-route.md](../.claude/commands/new-api-route.md)** — criar nova rota de API (validação, RBAC, Prisma)
- **[new-page.md](../.claude/commands/new-page.md)** — criar nova página no dashboard (auth, fetch, UX)
- **[db-migration.md](../.claude/commands/db-migration.md)** — adicionar/alterar campos no banco (SQL manual, rollback)

---

## Como Usar

### Cenário 1: Não sabe por onde começar

1. Leia `CLAUDE.md` (stack, estrutura)
2. Leia `DOMAIN.md` (o que significa agendamento, broadcast, etc.)
3. Leia `ARCHITECTURE.md` se propor mudança estrutural

### Cenário 2: Criar nova rota de API

1. Leia `.claude/commands/new-api-route.md`
2. Copie template base
3. Siga checklist de segurança + tipos

### Cenário 3: Criar nova página no dashboard

1. Leia `.claude/commands/new-page.md`
2. Copie padrão with-auth
3. Siga checklist UX + performance

### Cenário 4: Adicionar campo ao banco

1. Leia `.claude/commands/db-migration.md`
2. Crie `schema.prisma` + SQL manual
3. Siga rollback procedure

---

## Estrutura do Projeto

```
medlago-app/
├── CLAUDE.md                    ← Leitura obrigatória do agente
├── src/
│   ├── app/
│   │   ├── api/                 ← Route Handlers (ver new-api-route.md)
│   │   ├── dashboard/           ← Pages (ver new-page.md)
│   │   └── layout.tsx           ← Root layout com Auth
│   ├── contexts/
│   │   └── AuthContext.tsx      ← Global auth state
│   ├── lib/
│   │   ├── auth.ts              ← RBAC, password hashing
│   │   ├── jwt.ts               ← JWT sign/verify
│   │   ├── prisma.ts            ← Singleton client
│   │   ├── evolution-api.ts     ← WhatsApp wrapper
│   │   └── r2.ts                ← Cloudflare R2 storage
│   └── middleware.ts            ← Auth + RBAC enforcement
├── prisma/
│   ├── schema.prisma            ← Data model (ver db-migration.md)
│   ├── migrations/              ← SQL manual
│   └── seed.ts
├── docs/
│   ├── README.md                ← Este arquivo
│   ├── DOMAIN.md                ← Glossário + fluxos
│   └── ARCHITECTURE.md          ← Decisões + raciocínio
└── .claude/
    └── commands/
        ├── new-api-route.md
        ├── new-page.md
        └── db-migration.md
```

---

## Regras de Ouro

✅ **Faça:**
- Ler CLAUDE.md antes de propor mudanças
- Seguir templates em `.claude/commands/`
- Validar input em Route Handlers
- Usar soft delete (update `deleted_at`)
- RBAC check em operações sensíveis (PUT, DELETE)

❌ **Não faça:**
- Introduzir Redux/Zustand (state local é suficiente)
- Criar service layer (Prisma direto é OK)
- Usar `prisma migrate dev` (SQL manual)
- Expor R2 bucket direto
- Confiar em headers de cliente para auth (sempre validar)

---

## Performance

- Queries: use `.select()` para campos necessários apenas
- Paginação: `.skip().take()` para listas grandes
- Índices: `@@index()` em campos de filtro frequente
- Caching: headers `Cache-Control` em reads estáveis
- Bundling: Tailwind purga automático, sem CSS extras

---

## Segurança

- **Passwords:** bcryptjs 12 rounds
- **Tokens:** HttpOnly cookies (nunca localStorage)
- **RBAC:** verificado em middleware + route handler
- **SQL:** impossível com Prisma (parametrized queries)
- **CORS:** whitelist, não permissivo
- **PII:** nunca logar, nunca expor em erros (compliance LGPD)

---

## Stack — Resumo Rápido

| Camada | Stack |
|--------|-------|
| Framework | Next.js 16 (App Router) |
| Auth | JWT custom (jose) + HttpOnly cookies |
| DB | PostgreSQL + Prisma 6 |
| UI | React 19 + Tailwind 4 + Lucide |
| Storage | Cloudflare R2 (S3-compatible) |
| WhatsApp | Evolution API (duas instâncias) |
| Deploy | Netlify |

---

## Dúvidas?

Não está claro? Procure em:

1. `CLAUDE.md` — stack e padrões gerais
2. `DOMAIN.md` — semântica de negócio
3. `ARCHITECTURE.md` — por quês das decisões
4. `.claude/commands/` — procedimentos
5. `src/` — código de referência
6. git log — histórico de mudanças

Boa sorte! 🚀
