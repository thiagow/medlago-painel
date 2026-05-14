# Chat State Machine — Estados e Transições

Documentação completa da máquina de estados que governa cada conversa WhatsApp.

---

## 📊 Estados Válidos

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  [ai] ──(transfer)──→ [waiting] ──(assume)──→ [human]       │
│   ↑                                             |            │
│   |                                             |            │
│   └──(reactivate)──── (finish) ────→ [finished]             │
│                                             |                │
│                                    (external) →             │
│                          [transferred_external]             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

| Status | ai_service | finished | Significado |
|--------|-----------|----------|-------------|
| `ai` | `active` | `false` | IA respondendo ativamente |
| `waiting` | `waiting` | `false` | Aguardando atendente assumir |
| `human` | `paused` | `false` | Atendente em atendimento |
| `finished` | `paused` | `true` | Encerrado pelo atendente |
| `transferred_external` | `paused` | `true` | Transferido para contato externo |

---

## 🔑 Campos Críticos em `chats`

```sql
CREATE TABLE chats (
  id UUID PRIMARY KEY,
  phone VARCHAR UNIQUE,
  
  -- Estado Principal
  status VARCHAR(30),           -- 'ai' | 'waiting' | 'human' | 'finished' | 'transferred_external'
  ai_service VARCHAR,           -- Compatibilidade: 'active' | 'waiting' | 'paused'
  finished BOOLEAN,             -- true = atendimento encerrado
  
  -- Auditoria
  finished_at TIMESTAMPTZ,
  finished_by BIGINT,           -- user_id who finished
  assigned_to BIGINT,           -- user_id of attendant
  assigned_at TIMESTAMPTZ,
  
  -- Context
  department_id BIGINT,
  
  -- Timestamps
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP          -- soft delete
);
```

**Importante:** Sempre atualizar **ambos** `status` AND `ai_service` juntos para manter compatibilidade legada.

---

## 🔄 Transições Detalhadas

### 1️⃣ **IA → Waiting** (Transferir para Atendente)

Quando usuário pede para falar com humano OU agente chama `encaminhar_para_atendente_humano`.

```sql
UPDATE chats SET
  status = 'waiting',
  ai_service = 'waiting',
  finished = false,
  department_id = <id_departamento>,
  updated_at = NOW()
WHERE id = <chat_id>;

-- Create transfer log
INSERT INTO chat_transfer_logs (
  chat_id, user_name, reason, summary, transfer_type, department_id
) VALUES (
  <chat_id>, 'Sistema', 'Solicitação de atendente', '...', 'human', <id>
);

-- Notify team: POST WhatsApp to NUMERO_EQUIPE with chat link + summary
```

**N8N Faz:**
- Flow 2 agent calls `encaminhar_para_atendente_humano` tool
- HTTP POST webhook
- Webhook receiver: executa SQL acima
- Sends WhatsApp notification

**App Mostra:**
- Chat status badge: "Transferring to human..."

---

### 2️⃣ **Waiting → Human** (Atendente Assume)

Quando atendente abre chat e clica "Assumir" ou "Responder".

```sql
UPDATE chats SET
  status = 'human',
  ai_service = 'paused',
  finished = false,
  assigned_to = <user_id>,
  assigned_at = NOW(),
  updated_at = NOW()
WHERE id = <chat_id>;

-- Create transfer log
INSERT INTO chat_transfer_logs (
  chat_id, user_id, transfer_type
) VALUES (
  <chat_id>, <user_id>, 'assume'
);
```

**App Faz:**
- Atendente clica botão "Assumir"
- POST `/api/chats/[id]/assign`
- Updates `assigned_to` field
- Updates `status` to 'human'
- Blocks N8N from calling IA (gate: `ai_service = 'paused'`)

**N8N Detecta:**
- Next webhook: Flow 1 `validaPausa` gate → returns false
- Message is only logged (not sent to IA)

---

### 3️⃣ **Human → Finished** (Encerrar Atendimento)

Quando atendente marca chat como resolvido.

```sql
UPDATE chats SET
  status = 'finished',
  ai_service = 'paused',
  finished = true,
  finished_at = NOW(),
  finished_by = <user_id>,
  updated_at = NOW()
WHERE id = <chat_id>;

-- Disable messages (soft archive)
UPDATE chat_messages SET active = false 
WHERE chat_id = <chat_id>;

-- Create transfer log
INSERT INTO chat_transfer_logs (
  chat_id, user_id, transfer_type, finished_at
) VALUES (
  <chat_id>, <user_id>, 'finish', NOW()
);
```

**App Faz:**
- Atendente clica "Encerrar"
- POST `/api/chats/[id]/finish`
- Chat moves to "Archive" tab

**N8N:** 
- Chat não recebe mais mensagens (gate bloqueia)

---

### 4️⃣ **Any → Transferred External** (Contato Externo)

Quando transferir para especialista externo ou outro serviço.

```sql
UPDATE chats SET
  status = 'transferred_external',
  ai_service = 'paused',
  finished = true,
  finished_at = NOW(),
  finished_by = <user_id>,
  updated_at = NOW()
WHERE id = <chat_id>;

-- Disable messages
UPDATE chat_messages SET active = false WHERE chat_id = <chat_id>;

-- Create transfer log
INSERT INTO chat_transfer_logs (
  chat_id, user_id, transfer_type, external_contact_id, reason
) VALUES (
  <chat_id>, <user_id>, 'external', <contact_id>, '...'
);
```

**App Faz:**
- Atendente seleciona contato externo
- POST `/api/chats/[id]/transfer-external`
- Chat marked as transferred, archived

---

### 5️⃣ **Human → AI** (Reativar IA)

Quando atendente quer que IA retome a conversa.

```sql
UPDATE chats SET
  status = 'ai',
  ai_service = 'active',
  finished = false,
  assigned_to = NULL,
  updated_at = NOW()
WHERE id = <chat_id>;

-- Reactivate messages (if were disabled)
UPDATE chat_messages SET active = true 
WHERE chat_id = <chat_id>;

-- Create transfer log
INSERT INTO chat_transfer_logs (
  chat_id, user_id, transfer_type, reason
) VALUES (
  <chat_id>, <user_id>, 'reactivate_ia', '...'
);
```

**App Faz:**
- Atendente clica "Devolver para IA"
- POST `/api/chats/[id]/reactivate-ai`
- Chat volta para status `ai`

**N8N:**
- Próxima mensagem: Flow 1 `validaPausa` gate → returns true
- Calls IA normalmente

---

## 🎯 N8N Flow 1 Gates (Validação de Estado)

### `validaPausa` — Gate Principal

```javascript
// Flow 1: ENTRADA E SAIDA CLINICA
if (chat.ai_service === 'paused' || chat.ai_service === 'waiting') {
  // DO NOT call IA
  // Just log message to chat_messages
  return false;  // Gate blocks further processing
} else {
  // chat.ai_service === 'active'
  // Proceed to call IA
  return true;
}
```

**Efeito:**
- `ai_service = 'paused'` → bloqueado
- `ai_service = 'waiting'` → bloqueado
- `ai_service = 'active'` → permitido

---

## 📋 Exemplo: Full Lifecycle

```
1. Usuário escreve WhatsApp
       ↓
2. N8N Flow 1: cria chat com status='ai', ai_service='active'
       ↓
3. N8N Flow 1: chamag CLINICA CONSOLE
       ↓
4. N8N Flow 2: Agente responde
       ↓
5. N8N Flow 1: envia resposta via WhatsApp
       ↓
6. ... (mais mensagens) ...
       ↓
7. Usuário: "Preciso de atendente"
       ↓
8. N8N Flow 2: agente detecta, chama "encaminhar_para_atendente_humano"
       ↓
9. N8N: UPDATE chats SET status='waiting', ai_service='waiting'
       ↓
10. N8N: POST WhatsApp para equipe (chat link)
       ↓
11. Atendente abre app, vê chat com status='waiting'
       ↓
12. Atendente clica "Assumir"
       ↓
13. App: POST /api/chats/[id]/assign
       ↓
14. DB: UPDATE chats SET status='human', ai_service='paused', assigned_to=user_id
       ↓
15. Atendente escreve resposta
       ↓
16. App: calls Evolution API / UAZAPI (instance=HUMANO)
       ↓
17. Usuário vê mensagem do atendente
       ↓
18. ... (mais mensagens) ...
       ↓
19. Atendente clica "Encerrar"
       ↓
20. App: POST /api/chats/[id]/finish
       ↓
21. DB: UPDATE chats SET status='finished', finished=true
       ↓
22. Chat move para "Archive" em app
       ↓
23. N8N Flow 1 nova mensagem: validaPausa gate → retorna false
       ↓
24. Mensagem apenas logada (não respondida)
```

---

## ⚠️ Sync Issues

### "Chat ainda aparece como IA respondendo"

**Problema:** `ai_service` não foi atualizado
**Solução:**
```sql
-- Verify current state
SELECT status, ai_service FROM chats WHERE id=?;

-- Should match:
-- status='waiting' AND ai_service='waiting'  OR
-- status='human' AND ai_service='paused'  OR
-- status='finished' AND ai_service='paused'

-- If mismatch: manual fix
UPDATE chats SET ai_service='paused' WHERE status='human';
```

### "App mostra atendente mas N8N ainda responde"

**Problema:** `assigned_to` foi set mas `ai_service` não foi pausado
**Solução:**
```sql
UPDATE chats SET ai_service='paused' 
WHERE assigned_to IS NOT NULL AND ai_service != 'paused';
```

---

## 📊 Query Úteis

### Ver estado atual de todos os chats

```sql
SELECT 
  phone,
  status,
  ai_service,
  finished,
  assigned_to,
  assigned_at
FROM chats
WHERE deleted_at IS NULL
ORDER BY updated_at DESC
LIMIT 10;
```

### Ver transferências recentes

```sql
SELECT chat_id, user_id, transfer_type, created_at
FROM chat_transfer_logs
WHERE created_at > NOW() - interval '24 hours'
ORDER BY created_at DESC;
```

### Contar chats por estado

```sql
SELECT status, COUNT(*) as count
FROM chats
WHERE deleted_at IS NULL
GROUP BY status;
```

### Chats "presos" (em espera por >1h)

```sql
SELECT phone, status, updated_at
FROM chats
WHERE status='waiting' 
  AND updated_at < NOW() - interval '1 hour'
  AND deleted_at IS NULL;
```

---

## 🔐 Regra Fundamental

> **Ambos os campos `status` e `ai_service` DEVEM estar sincronizados:**
>
> - `status='ai'` ↔ `ai_service='active'`
> - `status='waiting'` ↔ `ai_service='waiting'`
> - `status='human'` ↔ `ai_service='paused'`
> - `status='finished'` ↔ `ai_service='paused'`
> - `status='transferred_external'` ↔ `ai_service='paused'`
>
> Se desincronizados: N8N não bloqueia corretamente, App não reflete estado

---

**Próxima leitura:**
- Como N8N valida estado: [FLOW_ENTRADA_SAIDA.md](FLOW_ENTRADA_SAIDA.md#gate-valida-se-ia-está-ativa)
- Como app atualiza estado: [INTEGRATION.md](INTEGRATION.md)
- Diagnosticar sync issues: [DEBUG_GUIDE.md](DEBUG_GUIDE.md)
