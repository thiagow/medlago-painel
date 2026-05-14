# Architecture Decisions — MedLago

Decisões de design com raciocínio. Leia antes de propor mudanças estruturais.

---

## Auth: JWT Customizado vs. NextAuth

**Decisão:** JWT customizado com `jose` + HttpOnly cookies.

**Por quê:**
- Controle total sobre duração de tokens (access 8h, refresh 7d)
- Roles customizados (admin, atendente) sem extensão de sessão
- Integração com middleware de borda para validação em runtime
- Menor surface de ataque que NextAuth (menos dependências)
- Refresh token rotation com invalidação imediata no logout

**Trade-offs:**
- Mais código (NextAuth é mais plug-and-play)
- Responsável por segurança de password hashing, token storage

**Quando mudar:**
- Se precisar integração com OAuth (Google, Microsoft) — considerar NextAuth + custom JWT coexistindo
- Se rate-limiting de login ficar crítico — adicionar feedback rate-limit, não mudar arch

---

## API: Route Handlers Diretos vs. Service Layer

**Decisão:** Prisma queries **direto em Route Handlers** (`src/app/api/**/route.ts`), sem abstração de service layer.

**Por quê:**
- Projeto em crescimento rápido — abstrações prematuras adicionam overhead
- Type safety de Prisma é suficiente para queries simples
- Middlewares (auth, logging) já abstraem cross-cutting concerns
- Dados de rota mapeiam 1:1 com modelos (não há lógica de domínio complexa)

**Quando mudar:**
- Quando aparecer duplicação de queries em 3+ rotas
- Quando regra de negócio exigir transações multi-entidade complexas
- **Sinais de aviso:** if/else nested, função > 30 linhas, lógica de cálculo

**Não fazer:**
- Repository pattern genérico (YAGNI)
- DTOs de entrada/saída (tipos Prisma são suficientes)
- Injeção de dependências

---

## Estado: React Context vs. Zustand/Redux

**Decisão:** Local React state + `AuthContext` para estado global de auth.

**Por quê:**
- Sem estado global compartilhado entre páginas (cada page é self-contained)
- Dados são fetched on-demand via `fetch()` → API routes
- AuthContext é o mínimo: dados do usuário logado, roles, token refresh
- Reducir dependencies (sem `redux`, `zustand`, `jotai`)

**Quando mudar:**
- Se aparecer estado compartilhado entre 3+ páginas
- Se polling/real-time exigir cache centralizado
- Se operações offline ficarem críticas

**Padrão atual:** `useState` local + refetch manual. É OK.

---

## WhatsApp: Duas Instâncias (IA vs. Humano)

**Decisão:** Dois endpoints Evolution API separados:
- `EVO_INSTANCE_BOT` — respostas IA automáticas
- `EVO_INSTANCE_HUMANO` — atendentes humanos

**Por quê:**
- Isolamento de rateLimit (limites de API não se interferem)
- Auditoria clara de quem respondeu (log de qual instância enviou)
- Possibilidade de fallback independente se um endpoint cair
- Diferentes números de WhatsApp (marca bot vs. clínica)

**Trade-offs:**
- Precisa manter duas credenciais diferentes (não é overhead)
- Roteamento de entrada precisa decidir qual instância responde
- Se futura integração com humanos responder 100%, pode consolidar

**Não fazer:**
- Unificar em uma instância (perde isolamento)
- Usar webhook genérico para ambos (difícil rastrear origem)

---

## Armazenamento: R2 Proxy vs. URL Direta

**Decisão:** Cloudflare R2 com proxy via `/api/media/proxy` + presigned URLs temporárias.

**Por quê:**
- **LGPD compliance:** URLs não são expostas direto (bucket R2 é privado)
- **CORS:** elimina issues de cross-origin (servidor é origem confiável)
- **Retenção:** fácil adicionar política de expiração no proxy (soft-delete files)
- **Auditoria:** log de quem acessa qual media

**Trade-offs:**
- Extra latência (um hop via servidor)
- Custos R2 incluem banda de proxy
- Presigned URL TTL é 2h (refresh necessário após)

**Quando mudar:**
- Se LGPD ficar menos restritivo (mudança legal) — expor R2 direto
- Se latência ficar crítica — adicionar CDN edge na frente
- Se mudar de R2 — abstração via `r2.ts` facilita swap

---

## Migrações: SQL Manual vs. Prisma Migrate

**Decisão:** SQL manual em `prisma/migrations/` + Prisma generate.

**Por quê:**
- Controle granular sobre alterações (não depender de injeção Prisma)
- Possibilidade de data migrations complexas (scripts SQL custom)
- Histórico versionado + auditável (git)
- Prisma generate mantém tipos sincronizados

**Trade-offs:**
- Precisa validar SQL manualmente
- Sem rollback automático (deve fazer SQL reverso explícito)

**Padrão:**
1. Editar `schema.prisma`
2. Criar arquivo `prisma/migrations/YYYYMMDDHHMMSS_reason.sql`
3. `npx prisma migrate resolve --applied`
4. `npx prisma generate`

**Não fazer:**
- `prisma migrate dev` (auto-generate) — pode gerar SQL não-otimizado
- Mix de Prisma auto-generate + SQL manual (confunde order)

---

## Banco: Prisma Singleton vs. Pool Manualmente

**Decisão:** PrismaClient global singleton em `src/lib/prisma.ts`.

**Por quê:**
- Next.js dev mode re-executa módulos — sem singleton vaza conexões
- PrismaClient já gerencia connection pool internamente
- Padrão recomendado por Prisma oficial

**Código:**
```typescript
let prisma: PrismaClient;
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) global.prisma = new PrismaClient();
  prisma = global.prisma;
}
```

**Não fazer:**
- `new PrismaClient()` em cada rota (connection leak)
- `DATABASE_URL` com pool externo e PrismaClient pool (double-pooling)

---

## Middleware: Edge Auth vs. Server Auth

**Decisão:** Middleware (`src/middleware.ts`) valida JWT na borda, injeta headers.

**Por quê:**
- Rejeita requests inválidas antes de chegar à route handler
- Injeção de headers (`x-user-id`, `x-user-role`) evita re-parsing em cada rota
- RBAC global (admin-only routes bloqueadas no middleware)
- Performance: validação é O(1) JWT decode

**Trade-offs:**
- Headers podem ser spoofed se ignorados (mas route handlers validam)
- Middleware não pode acessar Prisma (edge runtime)

**Não fazer:**
- Confiar 100% em headers — sempre re-validar em routes críticas
- Lógica de negócio no middleware (só auth + RBAC)

---

## UI: Tailwind 4 + Lucide Icons

**Decisão:** Tailwind CSS 4 (latest) + Lucide React para icons.

**Por quê:**
- Tailwind 4: CSS de primeira classe, melhor performance, menor bundle
- Lucide: biblioteca curada (não 8000 ícones, 1000 bem-desenhados)
- Ambas são zero-deps (Lucide é tree-shakeable)

**Padrão:**
- Utility-first (não criar componentes por "reutilização" de 2 linhas)
- Dark-mode first (`.dark:` prefixes)
- Responsive sem media queries manual (`sm:`, `md:`, `lg:`)

---

## Logging & Observability

**Status:** Minimal. Logs via `console.log` e Next.js built-in.

**Quando melhorar:**
- Se scale exigir debugging em produção
- Se security incidents precisarem auditoria
- Adicionar: Sentry (error tracking) + Vercel Analytics (performance)

**Não fazer:**
- Winston/Pino agora (overhead não justificado)
- Structured logging complexo (até precisar)

---

## Testing

**Status:** Não implementado sistematicamente.

**Quando adicionar:**
1. **Unit tests** em `src/lib/` (auth, format-phone, etc.) — Vitest
2. **Integration tests** em `src/app/api/` — Vitest + PrismaClient + test database
3. **E2E tests** para fluxos críticos (login, agendamento) — Playwright

**Não fazer:**
- Mock de Prisma (sempre usar test database)
- Mocks de Evolution API sem fallback real (pode falhar em produção)

---

## Performance: O Que Não Fazer

- Não adicionar Redux (state local é suficiente)
- Não criar REST API genérica (cada rota é específica)
- Não usar GraphQL (REST é suficiente, Apollo adiciona overhead)
- Não implementar real-time com WebSockets agora (polling é OK, adicionar quando necessário)
- Não otimizar imagens manualmente (Next.js `<Image />` faz)
- Não bundle CSS extras (Tailwind purga automático)

---

## Security: O Que Não Negociar

- Passwords sempre com bcryptjs (12 rounds)
- JWT sempre em HttpOnly cookies (nunca localStorage)
- Presigned URLs sempre com TTL curto (2h máximo)
- RBAC sempre verificado no middleware + route handler
- SQL injection: impossível com Prisma (parametrized queries)
- CORS: sempre restritivo (whitelist, não permissivo)

**Não fazer:**
- Armazenar tokens em sessionStorage/localStorage
- Confiar em headers de cliente para autorização
- Expor R2 bucket publicly
- Passwords em logs/errors
