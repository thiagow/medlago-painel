# Regras de Estado de Atendimento — Referência N8N

## Tabela `chats` — Campos de Estado

| Campo | Tipo | Descrição |
|---|---|---|
| `ai_service` | `VARCHAR` | Estado legado (manter compatibilidade) |
| `status` | `VARCHAR(30)` | **Estado principal** (novo) |
| `finished` | `BOOLEAN` | `true` = atendimento encerrado |
| `finished_at` | `TIMESTAMPTZ` | Quando foi encerrado |
| `finished_by` | `BIGINT` | ID do usuário que encerrou |
| `assigned_to` | `BIGINT` | ID do atendente atual |
| `assigned_at` | `TIMESTAMPTZ` | Quando o atendente assumiu |
| `department_id` | `BIGINT` | Departamento destino |

---

## Estados Válidos (`status`)

| `status` | `ai_service` | `finished` | Significado |
|---|---|---|---|
| `ai` | `active` | `false` | IA respondendo ativamente |
| `waiting` | `waiting` | `false` | Aguardando atendente humano assumir |
| `human` | `paused` | `false` | Atendente humano em atendimento |
| `finished` | `paused` | `true` | Encerrado pelo atendente |
| `transferred_external` | `paused` | `true` | Transferido para contato externo (encerrado) |

> **Regra:** Sempre atualizar **ambos** os campos `status` e `ai_service` juntos para manter compatibilidade.

---

## Transições de Estado

### 1. IA → Em Espera (Transferir para Equipe)
```sql
UPDATE chats SET
  ai_service = 'waiting',
  status = 'waiting',
  finished = false,
  department_id = <id_departamento>,  -- se houver
  updated_at = NOW()
WHERE id = <chat_id>;
```
+ Criar registro em `chat_transfer_logs`:
```json
{ "chat_id": X, "user_name": "...", "reason": "...", "summary": "...",
  "transfer_type": "human", "department_id": X }
```

### 2. Em Espera → Humano (Atendente Assume)
```sql
UPDATE chats SET
  ai_service = 'paused',
  status = 'human',
  finished = false,
  assigned_to = <user_id>,
  assigned_at = NOW(),
  updated_at = NOW()
WHERE id = <chat_id>;
```
+ Criar log com `transfer_type = 'assume'`

### 3. Humano → Finalizado (Encerrar Atendimento)
```sql
UPDATE chats SET
  ai_service = 'paused',
  status = 'finished',
  finished = true,
  finished_at = NOW(),
  finished_by = <user_id>,
  updated_at = NOW()
WHERE id = <chat_id>;
```
+ Desativar mensagens: `UPDATE chat_messages SET active = false WHERE phone = '...'`
+ Criar log com `transfer_type = 'finish'`

### 4. Qualquer estado → Transferido Externo
```sql
UPDATE chats SET
  ai_service = 'paused',
  status = 'transferred_external',
  finished = true,
  finished_at = NOW(),
  finished_by = <user_id>,
  updated_at = NOW()
WHERE id = <chat_id>;
```
+ Desativar mensagens
+ Criar log com `transfer_type = 'external'`, `external_contact_id = X`

### 5. Humano → IA (Reativar IA)
```sql
UPDATE chats SET
  ai_service = 'active',
  status = 'ai',
  updated_at = NOW()
WHERE id = <chat_id>;
```
+ Reativar mensagens: `UPDATE chat_messages SET active = true WHERE phone = '...'`

---

## Tabela `chat_transfer_logs` — Valores de `transfer_type`

| `transfer_type` | Evento |
|---|---|
| `human` | Transferência para equipe (IA → Espera) |
| `assume` | Atendente assumiu (Espera → Humano) |
| `finish` | Atendimento finalizado |
| `external` | Transferência para contato externo |

---

## Endpoint de Estatísticas

`GET /api/chats/stats?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

```json
{
  "by_status": { "ai": 0, "waiting": 0, "human": 0, "finished": 0, "transferred_external": 0, "total": 0 },
  "by_agent": [{ "id": "1", "name": "...", "total": 0, "finished": 0, "transferred_external": 0 }],
  "by_department": [{ "id": "1", "name": "...", "total": 0 }],
  "period": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }
}
```
