# Integração: N8N ↔ Next.js App

Como os fluxos N8N se conectam com o app Next.js sem se chamarem diretamente.

---

## 🔄 Padrão: DB Compartilhado, Sem Chamadas Diretas

```
N8N Flows                    Next.js App
    |                             |
    +----→ [Postgres DB] ←-------+
    |                             |
    +----→ [Redis] ←----+         |
    |                   |         |
    ↓                   ↓         ↓
Chat State            Chat State  User Interface
Chat Messages         (pause/resume IA)
```

**Importante:** N8N não chama API do app. App não chama N8N. Comunicação é via database.

---

## 🔌 Pontos de Integração

### 1. WhatsApp Entrada: Evolution API → N8N

```
WhatsApp User
    ↓
Evolution API / UAZAPI
    ↓
POST {N8N_webhook}
    Webhook Path: 0c81666b-84ce-47e2-be56-e793a9e5ab3a-10-10
    Body: { remoteJid, message, messageType, ... }
    ↓
ENTRADA E SAIDA CLINICA (Flow 1)
    ↓
Postgres: CREATE/UPDATE chats
    ↓
CLINICA CONSOLE (Flow 2)
    ↓
Postgres: INSERT chat_messages (direction='outbound')
    ↓
HTTP POST Evolution API / UAZAPI
    Endpoint: /message/sendText ou /message/sendMedia
    ↓
WhatsApp Response
```

**N8N não precisa saber sobre:** Painel do app, usuários logados, permissões.

### 2. WhatsApp Saída: App → Evolution API (UAZAPI)

```
Atendente no App
    ↓
POST /api/chats/[id]/send-message
    ↓
Next.js Route Handler (auth checked)
    ↓
sendEvolutionMessage() in src/lib/evolution-api.ts
    ↓
HTTP POST {EVO_DOMAIN}/message/sendText
    Instance: EVO_INSTANCE_HUMANO (atendente humano)
    ↓
UAZAPI (human agent instance)
    ↓
WhatsApp Message
```

**N8N não envolvo aqui.** Comunicação direta App → UAZAPI.

### 3. Sincronização de Estado: Database

```
N8N            Postgres              App
(Flow 1)         (DB)             (Next.js)
    |              |                  |
    +→ reads ---→ chats           ← writes (pause/resume)
    |              |                  |
    +→ writes --→ chat_messages ← reads (UI history)
    |              |                  |
    | ai_service   |
    +→ paused by "transfer" tool (sets ai_service='paused')
    |              ↓
    | App reads ai_service='paused'
    +← knows IA is paused, shows "transferred to human"
```

### 4. Credenciais & Environment Variables

**N8N Flow Credentials (em N8N):**
- OpenAI API key
- Evolution API key
- Postgres credentials
- Redis credentials

**App Env Vars (em `.env`):**
```
DATABASE_URL=postgres://...
EVO_DOMAIN=https://api.tiait.com.br  # ou https://medlago.uazapi.com
EVO_API_KEY=...
EVO_INSTANCE_BOT=clinicaMedLago
EVO_INSTANCE_HUMANO=medlago-agente
NUMERO_EQUIPE=+55 11 98765-4321  # Team WhatsApp for notifications
```

**App Usa:**
- `DATABASE_URL` → connect to Postgres (same DB as N8N)
- `EVO_DOMAIN` + `EVO_API_KEY` + `EVO_INSTANCE_*` → send messages via UAZAPI
- `NUMERO_EQUIPE` → notify team on actions

---

## 📊 Tabelas Compartilhadas

### `chats` — Conversa com Paciente

```sql
CREATE TABLE chats (
  id UUID PRIMARY KEY,
  phone VARCHAR UNIQUE,         -- ← Key matching
  ai_service VARCHAR,           -- 'ai' | 'paused' | 'human'
  status VARCHAR,               -- 'open' | 'waiting' | 'finished'
  assigned_to UUID,             -- atendente que pegou
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP,
  ...
);
```

**Leitura por N8N:**
- Acessar `ai_service` (IA pausa gate em Flow 1)
- Acessar `updated_at` (auto-reativa IA se expirou)

**Escrita por N8N:**
- Update `ai_service` → 'paused' (quando transfer)
- Update `updated_at` → reativaBot logic

**Leitura por App:**
- Acessar `ai_service` → mostra status (paused = "transferring to human")
- Acessar `status` → mostra estado (open, waiting, finished)
- Acessar `assigned_to` → mostra qual atendente

**Escrita por App:**
- Update `assigned_to` → quando atendente toma conversa
- Update `ai_service` → 'paused' (quando pausar manualmente)
- Update `status` → 'finished' (quando encerrar)

---

### `chat_messages` — Histórico de Mensagens

```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY,
  chat_id UUID REFERENCES chats(id),
  content TEXT,
  direction VARCHAR,            -- 'inbound' | 'outbound'
  created_at TIMESTAMP,
  created_by UUID,              -- user_id if humano, NULL if IA
  ...
);
```

**Escrita por N8N:**
- Inbound: recebe WhatsApp, insere `direction='inbound'`, `created_by=NULL` (IA)
- Outbound: IA responde, insere `direction='outbound'`, `created_by=NULL`

**Escrita por App:**
- Outbound: atendente escreve, insere `direction='outbound'`, `created_by=user_id`

**Leitura por App:**
- Fetch histórico para UI (`SELECT * FROM chat_messages WHERE chat_id=?`)

**Leitura por N8N:**
- Opcional: context para IA (raramente)

---

### `n8n_chat_histories` — Memory de IA

```
Table managed by N8N LangChain memory node
Key: identifier (phone number)
Value: serialized chat history (JSON)

user: "Quanto custa?"
assistant: "R$ 150..."
user: "E com convenio?"
assistant: "R$ 80..."
```

**Escrita por N8N:**
- Após cada query, memory node salva conversa

**Leitura por N8N:**
- Antes de cada query, carrega histórico anterior
- Agentes usam context para estar ciente de conversas prévias

**Nunca lido/escrito por App:**
- App não acessa N8N memory
- App tem seu próprio histórico em `chat_messages`

---

## 🔐 Sincronização Crítica: `ai_service` Field

### Estados

| Valor | Significado | N8N Faz | App Faz |
|-------|-------------|---------|---------|
| `'ai'` | IA respondendo | gate permite chamada | UI mostra "chat com IA" |
| `'paused'` | IA pausada | gate bloqueia chamada | UI mostra "transferring..." |
| (null) | Legado | — | — |

### Fluxo: App Pausa IA

```
Atendente clica "Pausar IA" no app
    ↓
POST /api/chats/[id]/pause
    ↓
UPDATE chats SET ai_service='paused' WHERE id=?
    ↓
N8N Flow 1 próxima mensagem:
    validaPausa gate → bloqueia
    Mensagem é apenas registrada
    ↓
Atendente responde via app
```

### Fluxo: N8N Transfer para Humano

```
User pedindo "falar com alguém"
    ↓
Flow 2 agente chama encaminhar_para_atendente_humano tool
    ↓
HTTP POST webhook para pausa
    ↓
N8N: UPDATE chats SET ai_service='paused' WHERE phone=?
    ↓
Notify team: POST WhatsApp com link do chat
    ↓
Atendente abre chat no app
    Vê ai_service='paused' → UI mostra "you can respond now"
    Chama send-message endpoint
    ↓
App verifica: ai_service='paused'? → Permite responder (não chama IA)
```

---

## 📝 Env Vars Alignment

**App `.env` deve espelhar N8N credentials:**

```bash
# App
EVO_DOMAIN=https://api.tiait.com.br          # Match N8N evoDomain
EVO_INSTANCE_BOT=clinicaMedLago              # Match N8N evoInstance (Flow 1)
EVO_INSTANCE_HUMANO=medlago-agente           # Match N8N evoInstance (Flow 2)

# N8N Flow 1 has:
evoDomain = "https://api.tiait.com.br"
evoInstance = "clinicaMedLago"
evoAPIKey = "E8AC27FE8EDD-4AB7-BC78-F5E1914772BA" (hardcoded - bad!)

# N8N Flow 2 has:
evoDomain = "https://medlago.uazapi.com"     # Different! (human agent instance)
evoInstance = "medlago-agente"
```

**Note:** Flow 1 usa instance de bot (`clinicaMedLago`), Flow 2 usa instance de humano (`medlago-agente`). São instâncias diferentes!

---

## 🔔 Notificações para Equipe

### Quando Transfer para Humano

N8N envia WhatsApp para `NUMERO_EQUIPE` com:
- Link do chat no app (manual: `/dashboard/conversations?id=...`)
- Resumo da conversa ("Paciente questiona política de reembolso")
- Motivo do transfer

App não envolvo: N8N faz notificação diretamente.

---

## 🔄 Fluxo End-to-End: Agendamento

```
1. User: "Quero agendar com cardiologista"
       ↓ WhatsApp
2. Evolution API webhook
       ↓ POST {N8N webhook}
3. ENTRADA E SAIDA CLINICA (Flow 1)
   - Create/update chats
   - Fetch content
   - Buffer in Redis
   - Call CLINICA CONSOLE
       ↓
4. CLINICA CONSOLE (Flow 2)
   - Load memory (Postgres chat_histories)
   - Router agent → agendador agent
   - Call Horarios sub-workflow
   - Display slots
       ↓ Response back to Flow 1
5. ENTRADA E SAIDA CLINICA
   - Format: "Temos 3 slots..."
   - Create chat_messages (outbound, direction='outbound')
   - Send via Evolution API / UAZAPI (bot instance)
       ↓ WhatsApp
6. User sees: "Próxima segunda às 10h? ✓"
       ↓ User clicks
7. User: "Sim, segunda às 10h"
       ↓ WhatsApp
8. ENTRADA E SAIDA CLINICA (Flow 1 again)
   - Receives confirmation
   - Calls CLINICA CONSOLE with "confirma agendamento"
       ↓
9. CLINICA CONSOLE (Flow 2)
   - Agendador agent calls Agendamento sub-workflow
   - Confirms appointment in DB
       ↓
10. Response: "Agendamento confirmado!"
       ↓
11. ENTRADA E SAIDA envia resposta via bot instance
       ↓
12. User: "Ótimo!" (app nunca envolvido aqui)

13. Meanwhile: Atendente abre app painel
       ↓
14. POST /api/chats/{chatId}
       ↓ (GET chat from Postgres)
15. App mostra histórico: inbound/outbound messages
       ↓ incluindo agendamento confirmado
16. Atendente envia mensagem extras (app calls Evolution API directly)
       ↓
17. App POST to {EVO_DOMAIN}/message/sendText
    Instance: EVO_INSTANCE_HUMANO (human agent)
       ↓
18. User vê: mensagem do atendente
```

---

## ⚠️ Sync Issues & Solutions

### "IA continua respondendo mesmo após pausar"

**Problema:** `ai_service` não foi atualizado
**Solução:** 
```sql
UPDATE chats SET ai_service='paused' WHERE phone=?;
-- Verify
SELECT ai_service FROM chats WHERE phone=?;
```

### "Histórico de mensagens fora de ordem"

**Problema:** App e N8N escrevendo `chat_messages` com timestamps diferentes
**Solução:** Certificar que ambos usam `NOW()` de Postgres (não local timestamps)

### "Agente não lembra da conversa anterior"

**Problema:** `identifier` não matching (phone format)
**Solução:** Garantir que N8N e app usam mesmo formato de telefone (ex: `+55 11 98765-4321`)

### "Transfer tool não disparou webhook"

**Problema:** N8N não tem conectividade externa OU webhook URL está errada
**Solução:** Testar webhook manualmente, verificar logs do N8N

---

## 🎯 Design Principles

1. **DB is Source of Truth:** Postgres é o ponto central de sincronização
2. **No Bidirectional Calls:** N8N não chama App API; App não chama N8N
3. **State via Fields:** Chat state lives in `chats` table (`ai_service`, `status`)
4. **Async by Nature:** Operações não dependem de respostas imediatas
5. **Eventual Consistency:** Delays OK (mensagens podem demorar segundos)

---

**Próxima leitura:**
- Debug problems: [DEBUG_GUIDE.md](DEBUG_GUIDE.md)
- Chat state machine: [STATE_MACHINE.md](STATE_MACHINE.md)
