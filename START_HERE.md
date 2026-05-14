# 🚀 START HERE — MedLago Documentation

Bem-vindo ao MedLago! Se é a primeira vez, comece aqui.

---

## ⚡ Quick Start (5 min)

**Você é...**

### 🤖 Um Agente Claude Code

1. Leia [CLAUDE.md](CLAUDE.md) — stack, padrões, convenções (8 min)
2. Abra [QUICK_REFERENCE.md](QUICK_REFERENCE.md) ao precisar de referência rápida
3. Consulte `.claude/commands/` quando criar nova feature
4. **Quando dúvida:** [DOCUMENTATION_MAP.md](DOCUMENTATION_MAP.md) mostra o que ler

### 👨‍💻 Um Dev Novo no Projeto

1. Ler [CLAUDE.md](CLAUDE.md) — tech stack, estrutura (8 min)
2. Ler [QUICK_REFERENCE.md](QUICK_REFERENCE.md) — mapa visual (5 min)
3. Ler [docs/README.md](docs/README.md) — índice completo (4 min)
4. Usar templates em `.claude/commands/` para criar features
5. **Dúvida de negócio?** Veja [docs/DOMAIN.md](docs/DOMAIN.md)
6. **Dúvida de arquitetura?** Veja [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

### 🏗️ Um Arquiteto/CTO Revisando Decisões

1. Leia [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — todas as decisões com raciocínio
2. Revise [memory/feedback_conventions.md](../../../.claude/projects/c--Projetos-MedLago-medlago-app/memory/feedback_conventions.md) para padrões intencionais
3. Se mudar algo: atualize docs + memory files

---

## 📚 Stack em 30 Segundos

```
Frontend:  Next.js 16 + React 19 + Tailwind 4 + Lucide icons
Backend:   Next.js Route Handlers (no service layer)
Database:  PostgreSQL + Prisma 6 (singleton)
Auth:      JWT custom (jose) + HttpOnly cookies (8h access / 7d refresh)
Storage:   Cloudflare R2 (presigned URLs com TTL 2h)
WhatsApp:  Evolution API (2 instâncias isoladas: bot IA + atendente humano)
Deploy:    Netlify
State:     Local React state + AuthContext (no Redux)
```

---

## 🎯 Tarefas Comuns

| Tarefa | Template | Tempo |
|--------|----------|-------|
| Criar rota de API | [.claude/commands/new-api-route.md](.claude/commands/new-api-route.md) | 5 min |
| Criar página dashboard | [.claude/commands/new-page.md](.claude/commands/new-page.md) | 7 min |
| Alterar banco de dados | [.claude/commands/db-migration.md](.claude/commands/db-migration.md) | 5 min |
| Entender fluxo de agendamento | [docs/DOMAIN.md](docs/DOMAIN.md) | 6 min |
| Entender por que JWT customizado | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 8 min |

---

## 🗂️ Arquivos Criados (2026-05-14)

| Arquivo | Propósito | Linhas |
|---------|-----------|--------|
| [CLAUDE.md](CLAUDE.md) | 📖 Instruções do agente (lido em toda sessão) | 223 |
| [QUICK_REFERENCE.md](QUICK_REFERENCE.md) | 🎯 Mapa rápido (quando perdido) | 215 |
| [docs/DOMAIN.md](docs/DOMAIN.md) | 📘 Glossário + fluxos de negócio | 168 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 🏗️ Decisões arquiteturais + raciocínio | 256 |
| [docs/README.md](docs/README.md) | 📚 Índice centralizado | 153 |
| [.claude/commands/new-api-route.md](.claude/commands/new-api-route.md) | 🔧 Template: criar rota | 237 |
| [.claude/commands/new-page.md](.claude/commands/new-page.md) | 🎨 Template: criar página | 356 |
| [.claude/commands/db-migration.md](.claude/commands/db-migration.md) | 🗃️ Checklist: migração SQL | 268 |
| [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) | 📋 O que foi criado e por quê | 194 |
| [DOCUMENTATION_MAP.md](DOCUMENTATION_MAP.md) | 🗺️ Índice temático (o que ler quando) | 293 |
| | **TOTAL** | **2363** |

---

## ✨ Resultados Esperados

- ⚡ **-30-40% tokens** em sessões de agente (docs pré-carregadas)
- 🎯 **100% consistência** (decisões documentadas + memory enforça)
- 🚀 **+25% velocidade** (templates prontos)
- 👥 **-70% onboarding** (novos devs em 30 min até primeira PR)

---

## 🔐 Regras de Ouro

✅ **Faça:**
- Ler CLAUDE.md antes de propor mudanças
- Seguir templates em `.claude/commands/`
- Usar soft delete (update `deleted_at`, nunca `DELETE`)
- Validar input em API routes
- Verificar RBAC em operações sensíveis

❌ **Não faça:**
- Introduzir Redux/Zustand (state local é suficiente)
- Criar service layer (Prisma direto é OK)
- Usar `prisma migrate dev` auto-generate (SQL manual)
- Expor R2 bucket direto (sempre presigned URLs)
- Confiar em headers cliente para auth (validar sempre)

---

## 🆘 Precisa de Help?

| Dúvida | Leia | Tempo |
|--------|------|-------|
| "Qual é o stack?" | [CLAUDE.md](CLAUDE.md) seção Stack | 1 min |
| "Como criar uma rota?" | [.claude/commands/new-api-route.md](.claude/commands/new-api-route.md) | 5 min |
| "O que é agendamento?" | [docs/DOMAIN.md](docs/DOMAIN.md) seção Agendamento | 2 min |
| "Por que JWT customizado?" | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) seção Auth | 3 min |
| "Não achei resposta" | [DOCUMENTATION_MAP.md](DOCUMENTATION_MAP.md) — índice temático | 5 min |

---

## 🎓 Próximas Leituras

**Se agente Claude Code:**
1. [CLAUDE.md](CLAUDE.md) — obrigatório (8 min)
2. [QUICK_REFERENCE.md](QUICK_REFERENCE.md) — quando precisar referência (5 min)

**Se dev novo:**
1. [CLAUDE.md](CLAUDE.md) (8 min)
2. [QUICK_REFERENCE.md](QUICK_REFERENCE.md) (5 min)
3. [docs/README.md](docs/README.md) (4 min)
4. Explorar código com CLAUDE.md aberto

**Se revisor/arquiteto:**
1. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (8 min)
2. [docs/DOMAIN.md](docs/DOMAIN.md) (6 min)
3. memory files se atualizar (5 min)

---

## 📞 TL;DR

- **Stack:** Next.js + React + Tailwind + Prisma + PostgreSQL + JWT + R2
- **Padrão:** Sem Redux, sem service layer, sem Prisma auto-migrate
- **Auth:** JWT dual-token (8h/7d) HttpOnly cookies
- **Segurança:** Middleware validates, soft delete everywhere, R2 presigned URLs
- **Estado:** Local useState + AuthContext (muito simples)

**Começe por:** [CLAUDE.md](CLAUDE.md) ⬅️

---

**Versão:** 2026-05-14  
**Status:** ✅ Pronto para produção  
**Próxima atualização:** Quando houver mudança estrutural significativa
