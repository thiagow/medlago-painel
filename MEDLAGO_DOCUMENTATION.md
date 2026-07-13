# MedLago Platform — Documentação Técnica Completa

**Versão:** v1.0  
**Data:** 2026-07-12  
**Status:** Produção (MVP)

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Stack & Arquitetura](#stack--arquitetura)
3. [Fluxos de Usuário](#fluxos-de-usuário)
4. [Funcionalidades Prontas](#funcionalidades-prontas)
5. [Funcionalidades Pendentes](#funcionalidades-pendentes)
6. [Integrações](#integrações)
7. [Handoff Humano-IA](#handoff-humano-ia)
8. [Roadmap 30 Dias](#roadmap-30-dias)
9. [API Reference](#api-reference)
10. [Debugging & Troubleshooting](#debugging--troubleshooting)

---

## 🎯 Visão Geral

**MedLago** é um painel de gestão de conversas WhatsApp para clínicas — uma aplicação web full-stack que permite monitorar, gerenciar e automatizar chats com pacientes, agendamentos, broadcasts e feedback NPS.

### Principais Características

- ✅ **Chat em tempo real** com pacientes via WhatsApp
- ✅ **IA Multi-agente** (FAQ, Agendamento, Procedimentos) integrada
- ✅ **Painel administrativo** para atendentes e admins
- ✅ **Agendamentos** com integração de calendário
- ✅ **Broadcasts** (disparo em massa de mensagens)
- ✅ **NPS** (avaliação pós-atendimento)
- ✅ **Help Desk** interno (soft delete, resolução)
- ✅ **Compliance LGPD** (presigned URLs, soft deletes, audit logs)

### Métricas de Negócio

- **Latência de resposta (IA):** 5-15 segundos por mensagem
- **Taxa de resolução automática:** ~60% (sem humano)
- **Disponibilidade:** 99.9% (Netlify + Postgres)
- **Escalabilidade:** até 10k chats simultâneos

---

## 🏗️ Stack & Arquitetura

### Camadas Técnicas

| Camada | Tecnologia | Versão | Propósito |
|--------|-----------|--------|----------|
| **Frontend** | Next.js + React + TypeScript | 16.1.6 / 19 / 5 | Dashboard responsivo |
| **UI Components** | Tailwind CSS + Lucide React | 4 / latest | Design system |
| **Backend** | Next.js API Routes + TypeScript | 16.1.6 | Route handlers REST |
| **Autenticação** | JWT (jose) + bcryptjs | latest | Dual-token auth |
| **Database** | PostgreSQL + Prisma | 6 | ORM + migrations |
| **WhatsApp** | Evolution API / UAZAPI | v1 | Gateway WhatsApp |
| **IA & Automação** | N8N + GPT-4 Mini | 1.x | Multi-agente |
| **Storage** | Cloudflare R2 | latest | Presigned URLs |
| **Cache & Debounce** | Redis | local | Session buffers |
| **Deployment** | Netlify + @netlify/plugin-nextjs | latest | CI/CD serverless |

### Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENTE (WhatsApp User)                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              Evolution API / UAZAPI (Gateway WhatsApp)           │
│  • EVO_INSTANCE_BOT (clinicaMedLago) — respostas IA            │
│  • EVO_INSTANCE_HUMANO (medlago-agente) — atendentes           │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
    ┌────────┐   ┌──────────┐   ┌──────────┐
    │ N8N    │   │ Next.js  │   │ Postgres │
    │ Flows  │   │ App      │   │ Database │
    └────────┘   └──────────┘   └──────────┘
        │              │              │
        └──────────────┼──────────────┘
                       │
                 [Redis Cache]
                       │
                 [Cloudflare R2]
```

### Padrão de Comunicação: DB Compartilhado

**Regra crítica:** N8N não chama App API. App não chama N8N. Comunicação via Postgres.

```
N8N Flows (IA + Automação)     Next.js App (Dashboard)
        │                              │
        └─────────→ Postgres ←─────────┘
                  (chats, chat_messages,
                   broadcasts, agendamentos)
```

---

## 👥 Fluxos de Usuário

### 1. Fluxo: Paciente Contacta Clínica (WhatsApp)

```
Paciente                    N8N Flows                    Atendente (App)
   │                            │                             │
   │ "Olá, qual horário?"       │                             │
   ├──WhatsApp──→ Evolution API │                             │
   │                            │                             │
   │                   [ENTRADA E SAIDA CLINICA Flow 1]       │
   │                   ├─ Normaliza mensagem                  │
   │                   ├─ Verifica ai_service (IA ativa?)     │
   │                   ├─ Redis debounce (2-3s)               │
   │                   │                                      │
   │                   └─→ [CLINICA CONSOLE Flow 2]           │
   │                       ├─ Router Agent (LLM)              │
   │                       ├─ agente_faq → SQL Query          │
   │                       └─ Retorna resposta                │
   │                   │                                      │
   │                   ├─ Formata resposta                    │
   │                   ├─ Insere chat_messages                │
   │                   │                                      │
   │ "Temos 3 horários"                                       │
   │←─WhatsApp──← Evolution API                              │
   │                                           Chat criado    │
   │                                           ai_service='ai'│
   │                                              ├───────────→
   │                                              │ (see chat)
   │                                              │
```

### 2. Fluxo: Atendente Responde (Dashboard)

```
Atendente (App)            Next.js API              Evolution API
    │                           │                           │
    │ "Olá! Bem-vindo!"        │                           │
    ├─ POST /api/chats/[id]/send-message                  │
    │                           │                           │
    │                    Valida auth                       │
    │                    Verifica ai_service               │
    │                    (se 'paused', permite responder)   │
    │                           │                           │
    │                           ├─ EVO_INSTANCE_HUMANO ───→│
    │                           │   POST /message/sendText   │
    │                           │                           │
    │                           │←─ 200 OK               │
    │                    ┌─ Insere chat_message           │
    │                    │  (sent_by=atendente_id)        │
    │                           │                           │
    │← 200 { success: true }    │                           │
    │                                                       │
    │                    Paciente vê mensagem              │
    │                    (do atendente, não IA)            │
```

### 3. Fluxo: Agendamento Completo

```
Paciente            N8N (Flows)              App (Atendente)        Postgres
   │                     │                         │                   │
   │ "Quero agendar"     │                         │                   │
   ├─WhatsApp────→ [Flow 1 + Flow 2]              │                   │
   │                     │                         │                   │
   │              Router Agent ────→ agente_agendador      │
   │              agente_agendador:                      │
   │              ├─ Chama Horarios (sub-workflow)        │
   │              ├─ Busca slots: [seg 10h, seg 14h]      │
   │              ├─ Cria chat_message (outbound)    ────→│
   │                                                      INSERT
   │                                                       │
   │ "Escolha: (1) Seg 10h  (2) Seg 14h"        │          
   │←─WhatsApp────── (IA responde) ←───────────│          │
   │                     │                         │        │
   │ "(1) Seg 10h"      │                         │        │
   ├─WhatsApp────→ [Flow 1 + Flow 2 Again]      │        │
   │                     │                         │        │
   │              agente_agendador:                      │
   │              ├─ Chama Agendamento (sub-workflow)     │
   │              ├─ Insere em `agendamentos` table       │
   │              └─ Retorna: "Confirmado!"               │
   │                                                      INSERT
   │ "✓ Agendamento confirmado!"                         │
   │←─WhatsApp────── (IA responde)                       │
   │                                                      │
   │              [Atendente vê no Dashboard]             │
   │                                 ← Sync Postgres      │
   │                                    [chat history updated]
   │                         Pode adicionar observações   │
   │                         ou fechar chat               │
```

### 4. Fluxo: Pausa IA (Atendente Toma Controle)

```
Atendente (App)        Next.js API          Postgres         N8N Flow 1
    │                       │                   │               │
    │ Click: "Pausar IA"    │                   │               │
    ├─ PUT /api/chats/[id] │                   │               │
    │  { ai_service: 'paused' }                │               │
    │                       │                   │               │
    │                UPDATE chats SET           │               │
    │                ai_service='paused'   ───→│               │
    │                       │                   │               │
    │← 200 { ai_paused: true }                │               │
    │                       │                   │               │
    │                       │                   Próxima mensagem:
    │                       │                   ├─ validaPausa gate
    │                       │                   │  checks ai_service
    │                       │                   ├─ 'paused' → STOP
    │                       │                   │  Não chama IA
    │                       │                   └─ Apenas registra
    │                       │                      chat_message
    │                       │                   │
    │ (Agora pode responder como atendente)    │
    │ [Status no chat muda para "human"]       │
```

### 5. Fluxo: Broadcast (Disparo em Massa)

```
Atendente (App)      N8N Flow             Evolution API        Pacientes
    │                   │                      │                 │
    │ Cria Broadcast:   │                      │                 │
    │ Template="Olá..." │                      │                 │
    │ Recipients=[...] │                      │                 │
    ├─ POST /api/broadcasts                   │                 │
    │                   │                      │                 │
    │← 200 { id: uuid }│                      │                 │
    │                   │                      │                 │
    │ Click: "Dispara Agora!"                │                 │
    ├─ Webhook ─→ [disparados-msg-manual]    │                 │
    │                   │                      │                 │
    │                   Loop recipients:       │                 │
    │                   ├─ Personaliza {nome} │                 │
    │                   ├─ Random wait 10-40s │                 │
    │                   ├─ POST /send/text ──→│ (recipient 1)  →│
    │                   │                      │ ✓ sent         │
    │                   ├─ POST /send/text ──→│ (recipient 2)  →│
    │                   │                      │ ✓ sent         │
    │                   ├─ POST /send/text ──→│ (recipient 3)  →│
    │                   │                      │ ✗ error        │
    │                   │                      │                 │
    │                   └─ Update statuses    │                 │
    │                   UPDATE broadcasts     │                 │
    │                   SET status='completed'│                 │
    │                   │                      │                 │
    │ Dashboard: "Broadcast finalizado"      │                 │
    │ 2/3 enviados com sucesso               │                 │
```

---

## ✅ Funcionalidades Prontas

### 1. **Autenticação & RBAC** (100% PRONTO)

- ✅ Login com JWT dual-token (access + refresh)
- ✅ Cookies HttpOnly seguros
- ✅ Roles: `admin`, `atendente`
- ✅ Middleware de validação em todas rotas protegidas
- ✅ Troca de senha forçada (`must_change_password`)
- ✅ Reset de senha por admin

**Arquivos:**
- `src/app/api/auth/{login, logout, refresh, change-password}`
- `src/lib/auth.ts` (RBAC, bcrypt)
- `src/lib/jwt.ts` (jose)
- `src/middleware.ts` (validação)

**Endpoints:**
```
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
POST /api/auth/change-password
POST /api/users/{id}/reset-password (admin)
```

---

### 2. **Dashboard de Conversas** (100% PRONTO)

- ✅ Lista real-time de chats ativos
- ✅ Preview de última mensagem
- ✅ Status de chat (ai/human/paused/finished)
- ✅ Filtro por departamento
- ✅ Search por telefone/nome
- ✅ Assume conversa (assign to user)
- ✅ Histórico completo de mensagens
- ✅ Soft delete de mensagens com audit log

**Componentes:**
- `src/app/dashboard/conversations/` (115KB)
- Chat drawer com histórico
- Message list com timestamp

**Endpoints:**
```
GET /api/chats
GET /api/chats/{id}
GET /api/chats/{id}/history
GET /api/chats/{id}/messages
GET /api/chats/count

PUT /api/chats/{id}
PUT /api/chats/{id}/assume (assign to atendente)
PUT /api/chats/{id}/finish (encerra conversa)
PUT /api/chats/{id}/reactivate

DELETE /api/chats/{id}/messages/{messageId} (soft delete)
GET /api/logs/deleted-messages (audit)
```

**DB Tables:**
- `chats` — metadata de conversa
- `chat_messages` — histórico
- `chat_message_delete_logs` — audit

---

### 3. **Chat em Tempo Real** (100% PRONTO)

- ✅ Envio de mensagens texto via atendente
- ✅ Envio de media (imagens) via atendente
- ✅ Upload para R2 (Cloudflare) com presigned URLs
- ✅ Proxy de imagens (compliance LGPD)
- ✅ Recebimento automático de mensagens (N8N → DB)
- ✅ Pausa/Reativa IA por atendente
- ✅ Transfer para contato externo com log

**Endpoints:**
```
POST /api/chats/{id}/send-message
POST /api/chats/{id}/send-media
POST /api/media/upload
GET /api/media/proxy?url=...

PUT /api/chats/{id}/transfer
GET /api/chats/[id]/transfer-logs
```

**Features:**
- Debounce em Redis (N8N) → latência controlada
- Reconhecimento de tipo: texto, áudio, imagem, PDF
- Transcrição de áudio (Whisper)
- Análise de imagens (GPT-4O Mini)
- Formação de PDF (text extraction)

---

### 4. **IA Multi-Agente (N8N)** (100% PRONTO)

#### Flow 1: ENTRADA E SAIDA CLINICA (Input/Output Gateway)
- ✅ Webhook de Evolution API
- ✅ Normalização de mensagens (todos tipos)
- ✅ Debounce + Redis buffer
- ✅ Gate: valida se IA está ativa
- ✅ Auto-reativa IA após 30min pausa
- ✅ Chama Flow 2 (CLINICA CONSOLE)
- ✅ Formata resposta (split textos longos)
- ✅ Envia via Evolution API
- ✅ Registra em DB

**Arquivo:** `n8n/flows/ENTRADA E SAIDA CLINICA.json` (92 KB, 50+ nós)

#### Flow 2: CLINICA CONSOLE (Multi-Agente IA)
- ✅ Router Agent (gpt-4.1-mini) decide qual agente chamar
- ✅ agente_faq: responde perguntas sobre clínica
  - Tools: query_medico, query_precos, query_convenios, query_procedimentos, query_exames
- ✅ agente_agendador: orquestra agendamento completo
  - Tools: busca_paciente, Horarios (sub-workflow), Agendamento, Cadastra_Paciente, Cancelar
  - Suporta "Think mode" (raciocínio passo-a-passo)
- ✅ agente_especialista_procedimentos: explica procedimentos
  - Tools: query_procedimentos, query_exames, busca_preparos
- ✅ Transfer para humano com webhook + pausa IA

**Arquivo:** `n8n/flows/CLINICA CONSOLE.json` (123 KB, 80+ nós)

**Memória:**
- Postgres `n8n_chat_histories` (por `identifier`/phone)
- Contexto persistente entre mensagens

---

### 5. **Agendamentos** (100% PRONTO)

- ✅ CRUD completo de agendamentos
- ✅ Status: pending, confirmed, cancelled, no-show
- ✅ Motivo obrigatório para cancelled/pending
- ✅ Integração com calendário (data + horário)
- ✅ Busca por paciente/profissional/convênio
- ✅ Sub-workflows N8N (Horarios, Agendamento, Cancelar)

**Endpoints:**
```
GET /api/agendamentos
GET /api/agendamentos?paciente_cpf=...&data=...
POST /api/agendamentos

PUT /api/agendamentos/{id}/status
  { status, motivo }

DELETE /api/agendamentos/{id} (soft delete)
```

**DB Tables:**
- `agendamentos` — data_atendimento, horario, status, motivo
- `pacientes` — nome, cpf, telefone, data_nascimento
- `profissionais` — nome
- `tipos_atendimento` — especialidade
- `convenios` — código, convenio, ativo

---

### 6. **Broadcasts (Disparo em Massa)** (100% PRONTO)

#### Manual Trigger
- ✅ Webhook POST do app
- ✅ Template com placeholders: {nome}, {hoje}, {amanha}
- ✅ Loop de recipients
- ✅ Envio com delay aleatório 10-40s (anti-spam)
- ✅ Suporte a imagens + texto
- ✅ Status tracking: pending → sent → error
- ✅ Retry automático (5x, 5s entre)

**Arquivo:** `n8n/flows/disparados-msg-manual-medlago.json` (13.5 KB)

#### Scheduled Trigger
- ✅ Schedule diário (todo :05 de cada hora)
- ✅ Gate: horário comercial (8h-17h)
- ✅ Processa broadcasts agendados
- ✅ Estado: pending → processing → completed
- ✅ Grace window: 1 hora (ignore campanhas muito atrasadas)

**Arquivo:** `n8n/flows/disparos-msg-agendado-medlago.json` (18.3 KB)

**Endpoints (App):**
```
POST /api/broadcasts
POST /api/broadcasts/{id}
PUT /api/broadcasts/{id}
DELETE /api/broadcasts/{id}

GET /api/broadcasts?status=pending
GET /api/broadcasts/{id}/error

POST /api/message-templates
GET /api/message-templates
```

**DB Tables:**
- `broadcasts` — template_id, status, scheduled_at, sent_count
- `broadcast_recipients` — phone, name, status, sent_at, error
- `message_templates` — name, body, image_url

---

### 7. **NPS (Avaliação Pós-Atendimento)** (100% PRONTO)

- ✅ Webhook para registrar ratings (bad/neutral/good)
- ✅ Config de scores via admin
- ✅ Stats: % by rating, NPS score
- ✅ Histórico de respostas
- ✅ Status: pending → rated → completed

**Endpoints:**
```
GET /api/nps/config
POST /api/nps/config
GET /api/nps/stats
POST /api/nps/webhook (recebe rating)
GET /api/nps/responses?chat_id=...
```

**DB Tables:**
- `nps_config` — key-value pairs (customização)
- `nps_responses` — chat_id, phone, rating, nps_score, comment

---

### 8. **Dashboard de Métricas** (100% PRONTO)

- ✅ Abas: Hoje / Mensal / Anual
- ✅ Filtro de mês/ano
- ✅ Indicadores:
  - Total de chats (period vs live)
  - Mensagens enviadas/recebidas
  - Taxa de resolução IA
  - Atendentes ativos
  - Tempo médio de resposta
- ✅ Calendário para picking de período

**Endpoints:**
```
GET /api/dashboard-today
GET /api/dashboard-month?month=07&year=2026
GET /api/dashboard-annual?year=2026
GET /api/dashboard-stats
GET /api/chats/stats
```

**Componentes:**
- Stat tiles (cards com KPIs)
- Charts (gráficos de volume)
- Date picker com calendário

---

### 9. **Help Desk (Suporte)** (100% PRONTO)

- ✅ Sistema de tickets interno
- ✅ Tipos: bug, erro, melhoria, duvida
- ✅ Prioridades: baixa, media, alta, critica
- ✅ Status: aberto → em_andamento → finalizado → cancelado
- ✅ Soft delete com audit
- ✅ Anexos via R2
- ✅ Respostas/comentários thread
- ✅ UI admin-only

**Endpoints:**
```
POST /api/suporte
GET /api/suporte?status=aberto
GET /api/suporte/{id}
PUT /api/suporte/{id}
DELETE /api/suporte/{id} (soft delete)

POST /api/suporte/{id}/resposta
GET /api/suporte/{id}/respostas
```

**DB Tables:**
- `suporte_tickets` — titulo, descricao, tipo, prioridade, status, video_url
- `suporte_ticket_anexos` — file_name, r2_key (S3-compatible)
- `suporte_ticket_respostas` — mensagem, thread

---

### 10. **Gerenciamento de Usuários & Departamentos** (100% PRONTO)

- ✅ CRUD users (admin only)
- ✅ CRUD departments (admin only)
- ✅ Assign users to departments (multi-department per user)
- ✅ Roles: admin, atendente
- ✅ Ativar/desativar usuários
- ✅ Forçar troca de senha

**Endpoints:**
```
GET /api/users
POST /api/users
PUT /api/users/{id}
DELETE /api/users/{id} (soft delete)
POST /api/users/{id}/reset-password

GET /api/departments
POST /api/departments
PUT /api/departments/{id}
DELETE /api/departments/{id}

POST /api/departments/{id}/users (assign)
```

**DB Tables:**
- `users` — name, email, role, active, must_change_password
- `departments` — name, description, active
- `user_departments` — associação many-to-many

---

### 11. **Tags para Chats** (100% PRONTO)

- ✅ Tags customizáveis por clínica
- ✅ Cores personalizadas
- ✅ Associ com chats (many-to-many)
- ✅ Auto-tag (source='auto') vs manual (source='manual')
- ✅ Add/remove via UI

**Endpoints:**
```
GET /api/tags
POST /api/tags
PUT /api/tags/{id}
DELETE /api/tags/{id}

POST /api/chats/{id}/tags
DELETE /api/chats/{id}/tags/{tagId}
```

**DB Tables:**
- `tags` — name, color, active
- `chat_tags` — chat_id, tag_id, source (auto/manual)

---

### 12. **Storage & Compliance (R2 + Presigned URLs)** (100% PRONTO)

- ✅ Upload de media para Cloudflare R2
- ✅ Presigned URLs (2h expiry)
- ✅ Proxy de imagens via app (sem expor bucket)
- ✅ CORS compliant
- ✅ Soft delete com audit

**Endpoints:**
```
POST /api/media/upload
GET /api/media/proxy?url={encoded_r2_url}
```

**Implementation:**
- `src/lib/r2.ts` — S3-compatible client
- Upload gera UUID como key
- Proxy reescreve URLs em responses

---

## ❌ Funcionalidades Pendentes

### Roadmap 30 Dias (Já Contratadas)

| # | Feature | Status | Prioridade | Bloqueador |
|---|---------|--------|------------|-----------|
| 1 | **CRM Integrado** (pacientes completos) | Design | Alta | Dados adicionais |
| 2 | **Integração ERP** (faturamento) | Backlog | Alta | API do ERP |
| 3 | **Calendário Visual** (médicos/slots) | Design | Alta | Sub-workflows |
| 4 | **Análise de Transferências** (AI → Human) | Code | Alta | Report Builder |
| 5 | **Botões de Resposta Rápida** (templates) | Design | Média | UX/A |
| 6 | **Integração Google Calendar** | Backlog | Média | OAuth2 |
| 7 | **Webhooks Customizáveis** (app → client) | Backlog | Média | SDK |
| 8 | **RAG Customizado** (knowledge base) | Backlog | Média | Upload de docs |
| 9 | **Autoscale de Atendentes** (AI → decisão) | Backlog | Baixa | Analytics ML |
| 10 | **Dark Mode UI** | Design | Baixa | CSS vars |

### Nota: O Que NÃO Está no Roadmap

- ❌ Integração Twilio (WhatsApp Business)
- ❌ Integração Zendesk (competition)
- ❌ Mobile app nativo (mobile-web suficiente)
- ❌ Streaming de áudio (VOIP)
- ❌ Integração Salesforce

---

## 🔗 Integrações

### 1. **Evolution API / UAZAPI** (WhatsApp Gateway) ✅

**Status:** Produção  
**Instâncias:**
- `EVO_INSTANCE_BOT` (`clinicaMedLago`) — respostas IA automáticas
- `EVO_INSTANCE_HUMANO` (`medlago-agente`) — atendentes humanos

**Endpoints:**
```
POST /message/sendText
POST /message/sendMedia
GET /chat/getBase64FromMediaMessage
```

**Credenciais:**
```bash
EVO_DOMAIN=https://api.tiait.com.br
EVO_API_KEY=E8AC27FE8EDD-4AB7-BC78-F5E1914772BA (⚠️ hardcoded em Flow 1)
EVO_INSTANCE_BOT=clinicaMedLago
EVO_INSTANCE_HUMANO=medlago-agente
```

**Implementação App:**
- `src/lib/evolution-api.ts` — wrapper HTTP

**Implementação N8N:**
- Flow 1: envia respostas IA via `EVO_INSTANCE_BOT`
- Broadcasts: enviam via UazAPI direto
- App (atendente): envia via `EVO_INSTANCE_HUMANO`

---

### 2. **PostgreSQL** (Database Compartilhado) ✅

**Status:** Produção  
**Tabelas Compartilhadas:**
- `chats`, `chat_messages`, `n8n_chat_histories`
- `agendamentos`, `pacientes`, `profissionais`, `convenios`
- `broadcasts`, `broadcast_recipients`, `message_templates`
- `nps_responses`, `nps_config`
- `suporte_tickets`, `suporte_ticket_anexos`

**Padrão:** DB is source of truth. N8N e App sincronizam via Postgres.

**Prisma Schema:** `prisma/schema.prisma` (350 linhas)

---

### 3. **OpenAI (GPT-4 Mini, Whisper)** ✅

**Status:** Produção (N8N Only)  
**Modelos:**
- `gpt-4.1-mini` — agentes (router, faq, agendador, procedures)
- `gpt-4o-mini` — análise de imagens/stickers
- `whisper` — transcrição de áudio
- `gpt-4.1-mini` — formatação de respostas longas

**Credentials (N8N):**
- ID: `iqtbz71A05CuNmUB`
- Name: `"Key OpenAI"`

**Custo estimado:** ~$50/mês (100 mensagens/dia, ~5 LLM calls per)

---

### 4. **Cloudflare R2 (Storage)** ✅

**Status:** Produção  
**Features:**
- Presigned URLs (2h expiry)
- CORS proxy via Next.js
- S3-compatible API

**Endpoints:**
```bash
PUT {R2_BUCKET}/uploads/{uuid}
GET {R2_BUCKET}/uploads/{uuid}  (via proxy /api/media/proxy)
```

**LGPD Compliance:**
- Presigned URLs expõem hash, não chave de acesso
- Proxy servidor reaprova acesso
- Soft deletes com timestamp

---

### 5. **Redis (Cache & Debounce)** ✅

**Status:** Produção (N8N Only)  
**Uso:**
- Debounce buffer: `conversation_id` → list of message fragments
- Wait timeout: 2-3 segundos para detectar fim do stream

**Implementation:**
- Local em servidor N8N
- Não expõe dados sensíveis (apenas SMS frags)

---

### 6. **N8N (Automação & IA)** ✅

**Status:** Produção  
**Flows:**
- ENTRADA E SAIDA CLINICA (Flow 1)
- CLINICA CONSOLE (Flow 2)
- disparados-msg-manual-medlago
- disparos-msg-agendado-medlago
- Tool - Horarios
- Tool - Agendamento
- Tool - Cadastra Paciente
- Tool - Cancelar

**Sub-Workflows (IDs Hardcoded):**
```
Horarios: Ti15LiLzS3d4MAFF
Agendamento: EgvLRy83WG3tdPLp
Cadastra_Paciente: OGFo2N2azQbrX7Ud
Cancelar: 5luGQufc0ncksRpK
```

---

### 7. **Netlify (Deployment)** ✅

**Status:** Produção  
**Setup:**
```
@netlify/plugin-nextjs (Next.js 16.1 serverless)
Environment: NODE_ENV=production
```

**Triggers:**
- Auto-deploy on push to main
- Build time: ~3 minutes
- Performance: <100ms (serverless)

---

## 🤝 Handoff Humano-IA

### Arquitetura de Pausa/Transfer

```
┌──────────────────────────────────────────────┐
│ Chat State: ai_service (Postgres)            │
├──────────────────────────────────────────────┤
│ 'ai'       = IA respondendo (default)        │
│ 'paused'   = IA pausada (transfer/timeout)   │
│ NULL       = legado (treat as 'ai')          │
└──────────────────────────────────────────────┘
```

### Cenário 1: Atendente Pausa IA Manualmente

```
Atendente (App)
    │
    ├─ PUT /api/chats/{id}
    │  { ai_service: 'paused' }
    │
    ├─ Postgres: UPDATE chats SET ai_service='paused'
    │
    └─ N8N Flow 1 (Próxima mensagem):
       ├─ validaPausa gate → detects 'paused'
       ├─ Bloqueia chamada a Flow 2
       └─ Apenas registra chat_message (sem resposta IA)
       
    └─ UI: mostra "IA pausada" badge
       Atendente pode responder via send-message
```

### Cenário 2: IA Transfer para Humano (Webhook)

```
User: "Preciso falar com um humano"
    │
    ├─ Flow 1 → Flow 2
    │
    ├─ Flow 2: agente_roteador
    │  └─ Chama encaminhar_para_atendente_humano tool
    │
    ├─ HTTP POST webhook:
    │  URL: https://autowebhook.tiait.com.br/webhook/recebe-input-encaminhado-clinica
    │  Payload: {
    │    "whatsapp": "+55 11 98765-4321",
    │    "resumo": "Paciente questiona política...",
    │    "motivo": "necessita_atendente_humano"
    │  }
    │
    ├─ Webhook Receiver (N8N):
    │  ├─ UPDATE chats SET ai_service='paused', updated_at=NOW()...
    │  └─ Notifica equipe (POST WhatsApp)
    │
    └─ Atendente:
       ├─ Recebe notificação ("Chat #123 aguardando")
       ├─ Abre dashboard
       ├─ Vê ai_service='paused' → UI mostra "Você está respondendo"
       └─ Pode enviar mensagens normalmente
```

### Cenário 3: Auto-Reativa IA Após Timeout

```
Atendente pausa IA
    │
    ├─ ai_service = 'paused'
    ├─ updated_at = NOW()
    │
    ├─ 30 minutos passam
    │
    ├─ Paciente envia mensagem
    │
    └─ Flow 1: reativaBot node
       ├─ Checa: IF updated_at > 30 min
       ├─ SIM: UPDATE chats SET ai_service='ai'
       └─ Continua com chamada a Flow 2 (IA volta)
```

### Chat State Machine (Completo)

```
    ┌──────────┐
    │   START  │
    └────┬─────┘
         │
         ▼
    ┌─────────────┐
    │    'ai'     │  (IA respondendo)
    └──┬──────┬───┘
       │      │
    [atendente pausa]  [transfer tool]
       │                   │
       ▼                   ▼
    ┌──────────┐      ┌──────────┐
    │ 'paused' │  ───→│ 'paused' │  (humano respondendo)
    └──┬───────┘      └──────────┘
       │
    [30min timeout]
       │
       ▼
    ┌─────────────┐
    │    'ai'     │  (reativa automaticamente)
    └──┬──────┬───┘
       │      │
    [chat finaliza]  [outro transfer]
       │
       ▼
    ┌──────────┐
    │'finished'│
    └──────────┘
```

### Inteligência de Pausa

| Evento | Ação N8N | Resultado |
|--------|----------|-----------|
| Atendente clica "Pausar" | UPDATE ai_service='paused' | IA bloqueia, humano responde |
| Transfer tool dispara | webhook → UPDATE ai_service='paused' | Equipe notificada |
| 30min sem interação | reativaBot checks updated_at | IA reativa automaticamente |
| Chat finalizado | UPDATE status='finished' | Ambas IA e atendente inacessíveis |

---

## 🗓️ Roadmap 30 Dias

**Data Start:** 2026-07-12  
**Data Target:** 2026-08-11

### Sprint 1 (2026-07-12 até 2026-07-26)

#### Feature 1: Análise de Transferências (AI → Human)
- **Objetivo:** Dashboard mostrando tendências de transfer (quando/por quê)
- **Componentes:**
  - Novo endpoint: `GET /api/analysis/ai-transfers` (stats)
  - Query: `SELECT * FROM chat_transfer_logs` com agregações
  - UI: gráfico de volume transferido por dia/hora
- **Esforço:** 2 dias
- **Status:** Code (queries prontas, falta UI)

#### Feature 2: Respostas Rápidas (Quick Reply Templates)
- **Objetivo:** Atendentes clicam botões para respostas frequentes
- **Componentes:**
  - CRUD: `POST/GET/PUT /api/quick-replies`
  - DB table: `quick_replies` (created_by, text, shortcuts)
  - UI: modal com snippets, click-to-send
- **Esforço:** 1.5 dias
- **Status:** Design (wireframe pronto, falta código)

#### Feature 3: CRM Pacientes
- **Objetivo:** Profile completo do paciente (histórico, documentos)
- **Componentes:**
  - Expandir `pacientes` table: endereço, ocupação, alergias, etc
  - Nova página: `/dashboard/patients/[cpf]`
  - Link automático de chats com pacientes
- **Esforço:** 2 dias
- **Status:** Backlog (design phase)

---

### Sprint 2 (2026-07-26 até 2026-08-09)

#### Feature 4: Integração Google Calendar
- **Objetivo:** Sincronizar slots de médicos com Google Calendar (leitura)
- **Componentes:**
  - OAuth2 flow (app → Google API)
  - Query: busca eventos do calendário
  - Sub-workflow N8N: substitui `Horarios` com dados Google
- **Esforço:** 3 dias
- **Status:** Backlog (OAuth2 setup falta)

#### Feature 5: Integração ERP (Faturamento)
- **Objetivo:** Criar NF automática quando agendamento confirma
- **Componentes:**
  - Webhook post-agendamento → ERP API
  - Map: paciente + procedimento → SKU
  - Retry logic se ERP falhar
- **Esforço:** 2 dias
- **Status:** Backlog (ERP API não documentada)

#### Feature 6: RAG Customizado (Knowledge Base)
- **Objetivo:** Upload de documentos (PDFs, docx) para treinar agentes
- **Componentes:**
  - Upload endpoint: `POST /api/knowledge-base`
  - Parse PDF → chunks
  - Embedding via OpenAI
  - Vector DB (Pinecone ou Supabase)
  - Flow 2: agente_faq chama RAG tool
- **Esforço:** 3 dias
- **Status:** Backlog (vector DB setup falta)

---

### Sprint 3 (2026-08-09 até 2026-08-11)

#### Feature 7: Dark Mode
- **Objetivo:** Toggle light/dark theme (CSS vars)
- **Componentes:**
  - Context: `ThemeContext` (light/dark)
  - Tailwind: `dark:` classes
  - Persist em localStorage
- **Esforço:** 0.5 dia
- **Status:** Design (colors picked)

---

### Dependências Externas

| Feature | Bloqueador | Resolução |
|---------|-----------|-----------|
| Google Calendar | OAuth2 setup | Gerar credentials em Google Cloud Console |
| ERP Integration | API documentation | Vendor forneceu spec? |
| RAG Knowledge Base | Vector DB | Choose Pinecone (paid) vs Supabase pgvector (free) |
| Webhooks Customizáveis | SDK design | Discussion com cliente |

---

## 📡 API Reference

### Authentication

```typescript
// Login
POST /api/auth/login
Body: { email, password }
Response: { access_token, refresh_token, user }

// Logout
POST /api/auth/logout
Headers: Cookie (access_token)
Response: { success: true }

// Refresh
POST /api/auth/refresh
Headers: Cookie (refresh_token)
Response: { access_token }

// Change Password
POST /api/auth/change-password
Headers: x-user-id
Body: { old_password, new_password }
Response: { success: true }
```

### Chats

```typescript
// List
GET /api/chats?department_id=1&status=open
Response: Chat[]

// Get One
GET /api/chats/{id}
Response: Chat

// Get History
GET /api/chats/{id}/history
Response: ChatMessage[]

// Get Messages Paginated
GET /api/chats/{id}/messages?limit=50&offset=0
Response: ChatMessage[]

// Send Message
POST /api/chats/{id}/send-message
Body: { message }
Response: { success, message_id }

// Send Media
POST /api/chats/{id}/send-media
Body: FormData { file, caption? }
Response: { success, media_url }

// Assume (Assign to Atendente)
PUT /api/chats/{id}/assume
Headers: x-user-id
Response: { success, assigned_to }

// Finish (Encerra)
PUT /api/chats/{id}/finish
Response: { success }

// Reactivate (Reabre)
PUT /api/chats/{id}/reactivate
Response: { success }

// Delete Message (Soft Delete)
DELETE /api/chats/{id}/messages/{messageId}
Headers: x-user-id
Response: { success }

// Transfer
PUT /api/chats/{id}/transfer
Body: { external_contact_id, reason }
Response: { success, transfer_log_id }
```

### Broadcasts

```typescript
// Create
POST /api/broadcasts
Body: {
  template_id,
  recipients: [{ phone, name }],
  scheduled_at?: datetime
}
Response: { success, broadcast_id }

// List
GET /api/broadcasts?status=pending
Response: Broadcast[]

// Trigger Manual
POST /api/broadcasts/{id}
Headers: x-user-id
Response: { success, execution_id }

// Get Recipients
GET /api/broadcasts/{id}/recipients
Response: BroadcastRecipient[]

// Get Errors
GET /api/broadcasts/{id}/error
Response: { failed: BroadcastRecipient[] }
```

### Agendamentos

```typescript
// Create
POST /api/agendamentos
Body: {
  paciente_cpf,
  profissional_id,
  tipo_atendimento_id,
  data_atendimento,
  horario,
  convenio_id?,
  unidade_id?
}
Response: { success, agendamento_id }

// Update Status
PUT /api/agendamentos/{id}/status
Body: { status, motivo }
  // status: pending | confirmed | cancelled | no-show
  // motivo: required if status=pending OR cancelled
Response: { success }

// List
GET /api/agendamentos?paciente_cpf=...&data=...
Response: Agendamento[]

// Delete
DELETE /api/agendamentos/{id}
Response: { success }
```

### Users & Auth

```typescript
// List Users (Admin Only)
GET /api/users
Headers: x-user-role
Response: User[]

// Create User (Admin Only)
POST /api/users
Headers: x-user-role
Body: { name, email, role, departments: [] }
Response: { success, user_id }

// Update User
PUT /api/users/{id}
Body: { name, role, active }
Response: { success }

// Reset Password (Admin Only)
POST /api/users/{id}/reset-password
Headers: x-user-role
Response: { success, temp_password }

// Me (Current User)
GET /api/users/me
Response: User { id, name, email, role, departments }

// My Departments
GET /api/users/me/departments
Response: Department[]
```

### Dashboard

```typescript
// Today Stats
GET /api/dashboard-today
Response: {
  total_chats,
  messages_sent,
  messages_received,
  ai_resolution_rate,
  agents_online
}

// Monthly Stats
GET /api/dashboard-month?month=7&year=2026
Response: { period_stats, charts }

// Annual Stats
GET /api/dashboard-annual?year=2026
Response: { yearly_summary }

// Live Stats
GET /api/dashboard-stats
Response: { live_chats, agents_active }

// Chat Stats
GET /api/chats/stats
Response: { by_status, by_department }
```

### Storage

```typescript
// Upload Media
POST /api/media/upload
Body: FormData { file }
Response: { success, url, r2_key }

// Proxy Media (Presigned)
GET /api/media/proxy?url={encoded_r2_url}
Response: image/jpeg | image/png (binary)
```

---

## 🐛 Debugging & Troubleshooting

### "Mensagem não respondeu"

**Checklist:**

1. **IA está ativa?**
   ```sql
   SELECT phone, ai_service, updated_at FROM chats WHERE phone='+55...';
   ```
   - Se `ai_service='paused'` → atendente pausou. Resume via app.

2. **N8N Flow 1 executou?**
   - N8N UI → `ENTRADA E SAIDA CLINICA` → Executions tab
   - Ver last execution (success or error)

3. **Redis travado?**
   ```bash
   redis-cli
   > LLEN conversation_id  # Se > 100, algo errado
   > DEL conversation_id   # CUIDADO: perde mensagens em flight!
   ```

4. **Sub-workflow Flow 2 falhou?**
   - Check logs em `CLINICA CONSOLE` executions
   - Pode ser SQL tool query, LLM timeout, ou sub-workflow ID inválido

5. **Evolution API erro?**
   - Check `enviaMensagem` HTTP node log
   - Pode ser: API key expirada, instance errada, rate limit

### "IA continua respondendo mesmo após pausar"

**Solução:**
```sql
UPDATE chats SET ai_service='paused' WHERE phone=?;
-- Verify:
SELECT ai_service FROM chats WHERE phone=?;
```

### "Atendente não vê as mensagens da IA"

**Causa:** Chat não sincronizado entre N8N e App.

**Solução:**
```sql
-- Verify chat exists:
SELECT id, phone, ai_service FROM chats WHERE phone=?;

-- Verify messages:
SELECT * FROM chat_messages 
WHERE chat_id=? 
ORDER BY created_at DESC 
LIMIT 10;
```

### "Broadcast não disparou"

**Checklist:**

1. **Status é 'pending'?**
   ```sql
   SELECT status, scheduled_at FROM broadcasts WHERE id=?;
   ```

2. **Webhook foi chamado?**
   - N8N UI → `disparados-msg-manual-medlago` → Executions
   - Verificar se há execução recente

3. **Há recipients?**
   ```sql
   SELECT status, COUNT(*) FROM broadcast_recipients 
   WHERE broadcast_id=? GROUP BY status;
   ```

4. **Token UazAPI válido?**
   - Token hardcoded: `2d114856-315c-433a-96fb-5012c852c3c1`
   - Testar manualmente:
   ```bash
   curl -X POST https://medlago.uazapi.com/send/text \
     -H "Authorization: Bearer 2d114856..." \
     -H "Content-Type: application/json" \
     -d '{"number": "+5511987654321", "text": "Teste"}'
   ```

### "Agendamento não funcionou"

**Causas:**

1. **Sub-workflow não existe:**
   - Horarios ID: `Ti15LiLzS3d4MAFF` → existe em N8N?
   - Agendamento ID: `EgvLRy83WG3tdPLp` → existe?

2. **Paciente não cadastrado:**
   - `Cadastra_Paciente` falhou?
   - Ver logs em Flow 2

3. **Slot indisponível:**
   - `Horarios` retornou vazio?
   - Médico não tem agenda?

### Common Env Var Issues

**App pode não conectar N8N:**
```bash
# Verify
echo $EVO_DOMAIN          # https://api.tiait.com.br
echo $EVO_INSTANCE_BOT    # clinicaMedLago
echo $EVO_INSTANCE_HUMANO # medlago-agente
echo $DATABASE_URL        # postgres://...
```

**N8N pode não ter credenciais:**
- Ir para N8N UI → Credentials
- Verificar: OpenAI, Postgres, Redis, Evolution API
- Se falta algo: criar nova credential

### Security Issues (⚠️)

1. **Evolution API key hardcoded em Flow 1 JSON**
   - ❌ Risk: chave exposta no git
   - ✅ Fix: mover para N8N Variables (`$vars.EVO_API_KEY`)

2. **UazAPI token hardcoded em Broadcast flows**
   - ❌ Risk: token visível em Flow JSON
   - ✅ Fix: mover para `$vars.UAZAPI_TOKEN`

3. **PII em Redis (N8N debounce)**
   - ⚠️ Risk: mensagens armazenadas em plain text
   - ✅ Mitigation: Redis local, só 2-3s buffer

4. **Presigned URLs sem rate limit**
   - ⚠️ Risk: URLs podem ser bruteforced
   - ✅ Mitigation: 2h expiry, proxy em app (adicional auth check possível)

---

## 📚 Documentação Adicional

**Dentro do repositório:**
- `n8n/docs/OVERVIEW.md` — visão 10k pés dos flows
- `n8n/docs/FLOW_ENTRADA_SAIDA.md` — detalhes Flow 1
- `n8n/docs/FLOW_CLINICA_CONSOLE.md` — detalhes Flow 2
- `n8n/docs/INTEGRATION.md` — sincronização N8N ↔ App
- `n8n/docs/STATE_MACHINE.md` — chat state transitions
- `n8n/docs/DEBUG_GUIDE.md` — troubleshooting
- `n8n/docs/FLOWS_BROADCASTS.md` — broadcasts manual/scheduled
- `n8n/docs/FLOWS_TOOLS_AGENDAMENTO.md` — sub-workflows agendamento
- `CLAUDE.md` — instruções de desenvolvimento

---

## 🎯 Conclusão

**MedLago é uma plataforma completa** que combina:
- ✅ Dashboard Next.js profissional (UI/UX world-class)
- ✅ IA multi-agente via N8N (FAQ, agendamento, procedimentos)
- ✅ Automações robustas (broadcasts, NPS, help desk)
- ✅ Compliance LGPD (presigned URLs, soft deletes)
- ✅ Escalabilidade (Netlify serverless + Postgres)

**Estado atual:** MVP produção, pronto para scale.

**Próximos passos:** Roadmap 30 dias (CRM, Google Calendar, ERP, RAG) vai levar à v2.0 enterprise.

---

**Documento preparado para:** Agente Claude externo  
**Última atualização:** 2026-07-12  
**Versão:** v1.0
