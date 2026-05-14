# Quick Reference — MedLago

Mapa rápido quando você não sabe por onde começar.

---

## 📚 Ler Primeiro

```
CLAUDE.md (raiz)
 ├─ Stack
 ├─ Estrutura crítica (pasta mapa)
 ├─ Auth & RBAC (JWT, middleware)
 ├─ Padrões de API
 ├─ WhatsApp (duas instâncias)
 ├─ Estado (React Context)
 └─ Convenções
```

## 🗂️ Estrutura

```
src/
├─ app/
│  ├─ api/          ← Route Handlers (sem service layer)
│  ├─ dashboard/    ← Pages (local state + AuthContext)
│  ├─ login/        ← Auth
│  └─ layout.tsx    ← Root + AuthProvider
├─ contexts/
│  └─ AuthContext.tsx ← Global auth only
├─ lib/
│  ├─ auth.ts       ← RBAC, bcryptjs
│  ├─ jwt.ts        ← jose sign/verify
│  ├─ prisma.ts     ← Singleton client
│  ├─ evolution-api.ts ← WhatsApp wrapper
│  └─ r2.ts         ← Cloudflare R2 proxy
└─ middleware.ts    ← JWT validation + RBAC + header injection

prisma/
├─ schema.prisma    ← Data model (com soft delete)
├─ migrations/      ← SQL manual (não auto-gen)
└─ seed.ts
```

## 🚀 Tarefas Comuns

### Criar Nova Rota de API

1. Ler `.claude/commands/new-api-route.md`
2. Template:
   ```typescript
   // src/app/api/[recurso]/[id]/route.ts
   export async function GET(req, { params }) {
     const userId = req.headers.get('x-user-id'); // middleware injetou
     if (!userId) return Response.json({ success: false }, { status: 401 });
     
     const record = await prisma.recurso.findUnique({ where: { id: params.id } });
     return Response.json({ success: true, data: record });
   }
   ```
3. Checklist: auth ✓ RBAC ✓ input validation ✓ error handling ✓ types ✓

### Criar Nova Página Dashboard

1. Ler `.claude/commands/new-page.md`
2. Template:
   ```typescript
   'use client';
   export default function Page() {
     const { user, loading } = useAuth();
     useEffect(() => { if (!loading && !user) router.push('/login'); }, []);
     
     const [data, setData] = useState([]);
     useEffect(() => {
       fetch('/api/recursos').then(r => r.json()).then(d => setData(d.data));
     }, []);
     
     return <div>...</div>;
   }
   ```
3. Checklist: auth ✓ fetch on mount ✓ loading state ✓ error state ✓ dark mode ✓

### Adicionar Campo ao Banco

1. Ler `.claude/commands/db-migration.md`
2. Editar `prisma/schema.prisma`
3. Criar `prisma/migrations/YYYYMMDDHHMMSS_reason.sql`
4. Rodar `npx prisma migrate resolve --applied` + `npx prisma generate`

### Deletar Registro

Sempre soft delete:
```typescript
await prisma.recurso.update({
  where: { id },
  data: { deleted_at: new Date() }
});

// Query sempre filtra:
prisma.recurso.findMany({
  where: { deleted_at: null }
});
```

---

## 🔐 Segurança Checklist

| Item | Regra |
|------|-------|
| Passwords | bcryptjs 12 rounds |
| Tokens | HttpOnly cookies (nunca localStorage) |
| Auth | Middleware valida, route handler re-valida |
| SQL | Prisma (parametrized), nunca raw queries |
| R2 | Presigned URLs com TTL 2h, nunca bucket público |
| CORS | Whitelist, não permissivo |
| PII | Nunca logar, erros genéricos |
| Motivo | Obrigatório em agendamento cancelado/pendente |

---

## 🚫 Não Fazer

- ❌ Redux/Zustand (estado local suficiente)
- ❌ Service layer (Prisma direto OK)
- ❌ `prisma migrate dev` (SQL manual)
- ❌ NextAuth (JWT custom é intencional)
- ❌ Expor R2 direto (sempre presigned URLs)
- ❌ Confiar em headers cliente (valide sempre)
- ❌ Deletar registro (sempre soft delete)

---

## 📖 Documentação Completa

| Arquivo | Quando Ler |
|---------|-----------|
| `CLAUDE.md` | Primeira coisa, sempre |
| `docs/DOMAIN.md` | Ao trabalhar com agendamento/chat/broadcast |
| `docs/ARCHITECTURE.md` | Ao propor mudança estrutural |
| `.claude/commands/new-api-route.md` | Antes de criar rota |
| `.claude/commands/new-page.md` | Antes de criar página |
| `.claude/commands/db-migration.md` | Antes de alterar banco |
| `docs/README.md` | Mapa completo de docs |

---

## 🏗️ Tech Stack — TL;DR

```
Frontend:    Next.js 16 + React 19 + Tailwind 4
Backend:     Next.js Route Handlers (no service layer)
Database:    PostgreSQL + Prisma 6 (singleton)
Auth:        JWT custom (jose) + HttpOnly cookies
Storage:     Cloudflare R2 + presigned URLs
WhatsApp:    Evolution API (2 instâncias isoladas)
Deploy:      Netlify
Styles:      Tailwind 4 + Lucide icons
State:       Local useState + AuthContext
```

---

## 🧭 Fluxos de Negócio

### Chat
WhatsApp → N8N webhook → Chat created → atendente responde → soft delete se necessário

### Agendamento
Create → status `agendado` → realizado/cancelado (requer motivo) → NPS trigger

### Broadcast
Draft → scheduled → sending → BroadcastRecipient (pending/sent/failed) → rastreia em ChatMessage

### Auth
Login → JWT access token (8h) + refresh token (7d) → middleware injeta headers → RBAC verifica

---

## 💡 Performance Tips

- Use `.select()` em Prisma para campos necessários
- Adicione índices: `@@index([field])` em filtros frequentes
- Paginação: `.skip().take()` em listas grandes
- Soft delete filter: sempre `where: { deleted_at: null }`
- Tailwind purga automático (sem CSS extras)
- R2 presigned URLs com TTL curto (2h máximo)

---

## 🐛 Debugging

```bash
npm run dev              # dev server :3000
npx prisma studio      # visual DB browser
npx prisma migrate status # check migrations
```

**Não fazer:** console.log de tokens, senhas, emails (compliance LGPD).

---

## 📞 Quando Chamar o CTO

- Mudança arquitetural proposta (Redux, NextAuth, service layer)
- Novo padrão de segurança (mudar auth, storage)
- Integração major (nova terceirizada, novo webhook)
- Decisão de scale (real-time, cache global)

O agente segue as decisões documentadas. Não propõe mudanças. ✅

---

**Última atualização:** 2026-05-14  
**Documentação criada por:** Claude Code
