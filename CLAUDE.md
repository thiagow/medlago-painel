# CLAUDE.md — MedLago App

## O projeto

**MedLago** é um painel de gestão de conversas WhatsApp para clínicas — um app web full-stack para monitorar e gerenciar chats com pacientes, agendamentos, broadcasts e NPS. Construído para máxima performance, segurança e compliance LGPD.

---

## Stack

| Camada | Stack |
|--------|-------|
| **Framework** | Next.js 16.1.6 (App Router) |
| **Linguagem** | TypeScript 5 |
| **UI** | React 19, Tailwind CSS 4, Lucide React |
| **ORM** | Prisma 6 (PostgreSQL) |
| **Auth** | JWT dual-token (jose), bcryptjs, custom middleware |
| **Storage** | Cloudflare R2 + presigned URLs |
| **WhatsApp** | Evolution API (UAZAPI) — duas instâncias isoladas |
| **Deployment** | Netlify (`@netlify/plugin-nextjs`) |
| **Utilidades** | date-fns, uuid, react-hot-toast |

---

## Estrutura crítica

```
src/
├── app/
│   ├── api/
│   │   ├── agendamentos/         (CRUD + status transitions)
│   │   ├── auth/                 (login, logout, refresh, change-password)
│   │   ├── broadcasts/           (envio de mensagens em massa)
│   │   ├── chats/                (fetch conversas, histórico)
│   │   ├── dashboard-{month,stats,today}/ (analytics)
│   │   ├── media/{upload,proxy}/ (R2 upload + CORS proxy)
│   │   ├── nps/                  (config, stats, webhook)
│   │   ├── patients/             (CRUD de pacientes)
│   │   ├── users/                (CRUD + roles)
│   │   └── [outros]/
│   ├── dashboard/
│   │   ├── conversations/        (main chat UI — 115KB)
│   │   ├── agendamentos/
│   │   ├── broadcasts/
│   │   ├── patients/
│   │   └── [outros]/
│   ├── login/ + change-password/
│   ├── layout.tsx                (AuthProvider + Toaster)
│   └── page.tsx                  (redirect / → /dashboard/conversations)
├── components/
├── contexts/
│   └── AuthContext.tsx           (React Context — user, roles)
├── lib/
│   ├── auth.ts                   (RBAC, password, user extraction)
│   ├── evolution-api.ts          (wrapper Evolution API)
│   ├── jwt.ts                    (sign/verify via jose)
│   ├── prisma.ts                 (singleton client)
│   └── r2.ts                     (S3-compatible Cloudflare)
└── middleware.ts                 (JWT validation + RBAC + header injection)

prisma/
├── schema.prisma                 (full data model)
├── migrations/                   (SQL manual migrations)
├── flows/                        (n8n JSON exports)
└── seed.ts
```

---

## Autenticação & RBAC

**Dual-token JWT:**
- `access_token` (8h, HttpOnly cookie)
- `refresh_token` (7d, HttpOnly cookie)
- Assinado com HS256 via `jose`
- Senha com bcryptjs (salt 12)

**Middleware (`src/middleware.ts`):**
- Intercepta `/dashboard/**` e `/api/**`
- Valida JWT do cookie
- Injeta headers: `x-user-id`, `x-user-role`, `x-user-email`
- Retorna 401 se inválido

**Client-side state:**
- `AuthContext` lê `medlago_user` do `sessionStorage`
- Persist automático em logout/login

**Roles:**
- `admin` — acesso total a users, departments, broadcasts
- `atendente` — visualiza/responde chats, acessa broadcasts como recipiente

---

## Padrões de API

**Route Handlers** em `/api/**/route.ts`:
- Identidade extraída de headers do middleware (`x-user-id`, `x-user-role`)
- Fallback: ler cookies se headers ausentes
- Prisma queries direto (sem service layer)
- REST: GET/POST/PUT/DELETE com `[id]` dinâmico
- Sempre retorna `{ success: boolean, data?: T, error?: string }`

**Exemplo mínimo:**
```typescript
// src/app/api/users/[id]/route.ts
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: params.id } });
  return Response.json({ success: !!user, data: user });
}
```

---

## WhatsApp — Evolution API

**Duas instâncias:**
- `EVO_INSTANCE_BOT` — respostas IA automáticas
- `EVO_INSTANCE_HUMANO` — atendentes humanos

**Header de auth:** `token` (não `Authorization`)

Wrapper em `src/lib/evolution-api.ts`:
```typescript
const evoApi = new EvolutionApiClient({
  baseUrl: process.env.EVO_BASE_URL,
  token: process.env.EVO_TOKEN,
});
```

**Padrão de webhook:** N8N recebe mensagens de entrada, cria/atualiza `Chat` + `ChatMessage`, dispara lógica de roteamento.

---

## N8N Flows — Automação & IA

**Dois fluxos críticos:**
- **Flow 1: ENTRADA E SAIDA CLINICA** — Gateway de entrada/saída de mensagens WhatsApp (92 KB, 50+ nós)
  - Recebe webhook de Evolution API
  - Normaliza por tipo de mensagem (text, audio→Whisper, image→gpt-4o-mini, document→PDF)
  - Debounce em Redis (2-3s buffer)
  - Chama Flow 2 (CLINICA CONSOLE)
  - Formata e envia resposta via Evolution API
  - Registra em `chats` + `chat_messages`

- **Flow 2: CLINICA CONSOLE** — Multi-agente IA (123 KB, 80+ nós)
  - Roteador agent (gpt-4.1-mini) decide: FAQ, agendamento, procedimentos, ou transfer humano
  - Sub-agentes especializados com tools SQL (query médicos, preços, convênios, etc)
  - Sub-workflows externos: Horarios, Agendamento, Cadastra_Paciente, Cancelar
  - Memory: Postgres `n8n_chat_histories` (keyed por telefone)
  - Transfer para humano via webhook: pausa IA, notifica equipe

**Localização:**
- JSONs: `n8n/flows/` — ENTRADA E SAIDA CLINICA.json, CLINICA CONSOLE.json
- Docs: `n8n/docs/` — OVERVIEW.md, FLOW_ENTRADA_SAIDA.md, FLOW_CLINICA_CONSOLE.md, STATE_MACHINE.md, INTEGRATION.md, DEBUG_GUIDE.md

**Sincronização DB:**
- N8N e app compartilham Postgres (`chats`, `chat_messages`, `n8n_chat_histories`)
- Estado da IA via `ai_service` field: `'active'` (respondendo), `'paused'` (atendente/transfer), etc
- App pode pausar IA, N8N reativa automaticamente após 30min
- Sem chamadas diretas entre N8N e app — tudo via DB

**Debugging:**
- Ver comando: `.claude/commands/n8n-debug.md` para checklists de troubleshooting
- Problemas comuns: IA pausada, Redis travado, sub-workflow falhou, credenciais expiradas
- ⚠️ Segurança: API key Evolution hardcoded em Flow 1 JSON — precisa rotacionar + mover para N8N Credentials

---

## Armazenamento — Cloudflare R2 & Compliance LGPD

**R2 Proxy Pattern:**
- Upload via `/api/media/upload` → R2 com `uuid` como key
- Acesso via `/api/media/proxy?url={encoded_r2_url}` (servidor actua como proxy)
- URLs presigned temporárias (2h) para não expor bucket direto
- Elimina CORS issues, mantém privacidade

**Implementação em `src/lib/r2.ts`** — usa `@aws-sdk/client-s3` com credentials R2.

---

## Estado & Renderização

**Sem Redux/Zustand** — arquitetura intencional:
- Local React state (`useState`) em cada página
- Dados fetched via `fetch()` direto às rotas de API
- `AuthContext` para estado global de auth apenas
- Refetch manual ou polling conforme necessário

---

## Migrações & Schema

**Database:**
- PostgreSQL via `DATABASE_URL`
- Schema definido em `prisma/schema.prisma`
- Migrações **manuais em SQL** em `prisma/migrations/`

**Criar campo novo:**
1. Editar `schema.prisma`
2. Criar `.sql` em `prisma/migrations/` (timestamp_reason.sql)
3. `npx prisma migrate resolve --applied` (ou `--rolled-back`)
4. `npx prisma generate`

**Singleton Prisma:**
```typescript
// src/lib/prisma.ts
let prisma: PrismaClient;
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) global.prisma = new PrismaClient();
  prisma = global.prisma;
}
```

---

## Convenções

- **Nomes de domínio em PT-BR:** `agendamento`, `paciente`, `convenio`, `atendente`, `profissional`, `tipo_atendimento`
- **IDs:** UUID v4 (gerado com `uuid()`)
- **Datas:** `date-fns` para parsing/formatting
- **Status:** enums em `schema.prisma` (ex: `AgendamentoStatus`)
- **Motivo obrigatório:** para status `pending` e `cancelled` em agendamentos (rule: `dae998e`)

---

## Comandos essenciais

```bash
npm run dev              # dev server :3000
npm run build            # next build
npx prisma studio       # visual DB browser
npx prisma migrate dev  # apply pending migrations
npx prisma seed         # seed data (seed.ts)
```

---

## O que ignorar

Scripts na raiz com padrão `check_*.js`, `debug_*.js`, `fix_*.cjs` — são debug temporário, não parte da app.

---

## Regras de design

- **Auth-first:** segurança em toda camada, não é fase posterior
- **Compliance:** LGPD (presigned URLs, soft deletes, audit logs quando necessário)
- **Type-safe:** TypeScript strict mode
- **Performance:** dados fetched conforme necessário, sem over-fetching
- **Sem abstrações prematuras:** service layers, repositories etc. vêm quando há duplicação real, não especulativa
