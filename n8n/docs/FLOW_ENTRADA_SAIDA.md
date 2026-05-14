# Flow 1: ENTRADA E SAIDA CLINICA — Documentação Detalhada

Gateway completo de entrada/saída de mensagens WhatsApp. Normaliza, processa, chama IA, formata resposta e envia de volta.

---

## 📋 Info Básica

- **Arquivo:** `flows/ENTRADA_E_SAIDA_CLINICA.json`
- **Tamanho:** 92 KB
- **Nós:** 50+ (alguns disabled para debug)
- **Entrada:** Webhook Evolution API (POST com mensagem)
- **Saída:** WhatsApp response + Postgres records
- **Sub-workflow:** Chama CLINICA CONSOLE (workflow ID `QkojhAJKkRHjxsth`)
- **Storage:** Postgres (`chats`, `chat_messages`) + Redis (buffer)
- **Credenciais:** Evolution API, OpenAI, Postgres, Redis

---

## 🔴 Fluxo Linear (Passo a Passo)

### 1. **Webhook Trigger**
```
POST {webhook-path}
Header: evo-api-key
Body: { remoteJid, message, messageType, ... }
```
- **Nó:** Webhook trigger node
- **Path:** `0c81666b-84ce-47e2-be56-e793a9e5ab3a-10-10`
- **ID:** `0c81666b-84ce-47e2-be56-e793a9e5ab3a`

### 2. **Normaliza Dados** → `puxaDadosTelefone`
- Extrai `remoteJid` (phone number)
- Query Postgres: `SELECT * FROM chats WHERE phone = remoteJid`
- Se não existe: `INSERT INTO chats` com `ai_service='ai'`
- Se existe: update `updated_at`
- **Nó:** Postgres node
- **Output:** Chat record

### 3. **Gate: Valida Se IA Está Ativa** → `validaPausa`
- JS Code: `if chat.ai_service === 'paused' return false else true`
- Se pausa: desvia fluxo para apenas registrar mensagem (sem chamar IA)
- Se ativa: continua para processa

- **Nó:** If node (condicional)
- **Critical:** Se falhar aqui, usuário não vê resposta

### 4. **Auto-reativa IA se Expirou** → `reativaBot`
- Postgres: se `updated_at` > 30 min, `UPDATE chats SET ai_service='ai'`
- Permite IA reativar automaticamente após pausa de atendente
- **Nó:** Postgres node

### 5. **Route por Tipo de Mensagem** → `switchTipo`
- `messageType` pode ser: `text`, `audio`, `image`, `sticker`, `document`, `conversation`, `reaction`
- **Nó:** Switch node
- **Caminhos:**
  - `text` → vai direto para debounce
  - `audio` → fetch base64 + Whisper transcription
  - `image` → fetch base64 + gpt-4o-mini analysis
  - `sticker` → fetch base64 + gpt-4o-mini analysis
  - `document` → fetch base64 + PDF text extraction
  - Outros → `noOp` (descarta)

---

## 📻 Processamento por Tipo de Mensagem

### Text (Direto para Redis)
```
message content → Redis list (push)
```

### Audio (Whisper Transcription)
```
messageType='audio'
    ↓
HTTP: Fetch base64 from Evolution API
    GET {evoDomain}/chat/getBase64FromMediaMessage/{evoInstance}
    ↓
@n8n/n8n-nodes-langchain.openAi (Whisper)
    ↓
transcribed_text → Redis list
```

### Image (GPT-4O-Mini Analysis)
```
messageType='image'
    ↓
HTTP: Fetch base64
    ↓
gpt-4o-mini: "Describe this image in Portuguese"
    ↓
image_description → Redis list
```

### Sticker (GPT-4O-Mini Analysis)
```
messageType='sticker'
    ↓
HTTP: Fetch base64 (.png)
    ↓
gpt-4o-mini: "What is this sticker expressing?"
    ↓
sticker_meaning → Redis list
```

### Document (PDF Text Extraction)
```
messageType='document'
    ↓
HTTP: Fetch base64 (PDF)
    ↓
Convert base64 → binary file
    ↓
PDF text extraction node
    ↓
extracted_text → Redis list
```

---

## 🔄 Debounce & Message Reconstruction

### Redis Buffer
- **Key:** `conversation_id` (phone number)
- **Value:** List of strings (one per user message part)
- **Purpose:** Hold message fragments until user finishes typing

### Wait Node (`esperaMais`)
- Espera **2-3 segundos**
- Se mais mensagens chegarem nesse período: reinicia contagem
- Se timeout: continua para reconstruct

### Compare Before/After
- Snapshot Redis list antes do Wait
- Snapshot Redis list depois do Wait
- Se diferentes: mensagens chegaram, reinicia Wait
- Se iguais: usuário parou de digitando, reconstruct

### Reconstruct (`reconstrutorMensagemFinal`)
- JS Code: junta array Redis em string única
- Remove duplicatas
- **Output:** `final_message` pronto para IA

---

## 🧠 Chama IA (Sub-workflow)

### Nó: `acionaMultiagentes`
- **Tipo:** Execute Workflow
- **Target:** CLINICA CONSOLE (workflow ID `QkojhAJKkRHjxsth`)
- **Input:**
  ```json
  {
    "query": final_message,
    "identifier": phone_number,
    "telefone": phone_number
  }
  ```
- **Output:** JSON response from IA
  ```json
  {
    "mensagem": "Olá! Como posso ajudar?",
    "imagens": ["url1", "url2"],
    "acao": "faq_respondida"
  }
  ```

---

## 💬 Formata & Envia Resposta

### Formata Mensagem (`formataMensagem`)
- Se texto é muito longo (> 800 chars):
  - Chama gpt-4.1-mini: "Split this into 2-3 shorter messages"
  - Retorna array de textos curtos
- Se há imagens: mantém array separado

### Split & Send em Batches
- **Nó:** Split Out / Split In Batches
- Para cada chunk do array:
  1. Se tem texto: enviar como texto
  2. Se tem imagem: enviar texto + imagem juntos

### HTTP: Envia via Evolution API
```
POST {evoDomain}/message/sendText/{evoInstance}
  Body: { number, text, ... }
  Header: { apikey }

OU

POST {evoDomain}/message/sendMedia/{evoInstance}
  Body: { number, media_url, caption, ... }
  Header: { apikey }
```
- **Nó:** `enviaMensagem` (HTTP Request)
- **Retry:** se falha, tenta até 3x

### Registra em Postgres
- **Nó:** `salvaMensagemSaida`
- ```sql
  INSERT INTO chat_messages (
    chat_id, content, direction, created_at, ...
  ) VALUES (
    chat.id, response_text, 'outbound', now(), ...
  )
  ```

---

## 🔑 Nós Críticos (Ordem de Importância)

| Nó | Tipo | Crítico? | O Que Faz |
|-----|------|----------|-----------|
| Webhook | trigger | ⭐⭐⭐ | Recebe mensagem |
| puxaDadosTelefone | postgres | ⭐⭐⭐ | Cria/atualiza chat |
| validaPausa | if/code | ⭐⭐⭐ | Gate se IA pausa |
| switchTipo | switch | ⭐⭐⭐ | Route por tipo |
| Redis_lista | redis | ⭐⭐ | Debounce buffer |
| esperaMais | wait | ⭐⭐ | Debounce timeout |
| reconstrutorMensagemFinal | code | ⭐⭐⭐ | Junta fragmentos |
| acionaMultiagentes | subworkflow | ⭐⭐⭐ | Chama IA |
| formataMensagem | code | ⭐⭐ | Split textos longos |
| enviaMensagem | http | ⭐⭐⭐ | POST WhatsApp |

---

## ⚠️ Segurança & Credenciais

### Hardcoded API Key (⚠️ SECURITY RISK)
- **Location:** Set node que define `evoDomain`, `evoInstance`, `evoAPIKey`
- **Value:** `E8AC27FE8EDD-4AB7-BC78-F5E1914772BA`
- **Domain:** `https://api.tiait.com.br`
- **Instance:** `clinicaMedLago`
- **Action Required:** Rotacionar esta chave e mover para N8N Credentials

### Credenciais Seguras (em N8N Credentials)
- OpenAI: ID `iqtbz71A05CuNmUB`, name `"Key OpenAI"`
- Postgres: ID `DHVsysbWnjZwX5BX`, name `"Conexao Postgre - DbMedLago"`
- Redis: ID `IDNBcpOdEiUCdWdx`, name `"Credencial Redis - Local"`

---

## 🗄️ Database Tables (Leitura/Escrita)

### `chats`
- **Lê:** `ai_service`, `status`, `updated_at`
- **Escreve:** `updated_at`, `ai_service` (reativaBot)
- **Key:** `phone`

### `chat_messages`
- **Escreve:** nova mensagem com `direction='outbound'`, `content`, `created_at`
- **FK:** `chat_id` references `chats.id`

---

## 🔴 Pontos de Falha Comuns

### "Mensagem não respondida"

1. **AI pausada?**
   - Check: `SELECT ai_service FROM chats WHERE phone = ?`
   - Se `ai_service = 'paused'`: flow retorna cedo (gate validaPausa)
   - Solução: `UPDATE chats SET ai_service='ai' WHERE phone=...`

2. **Redis travado?**
   - Check: `LLEN conversation_id` em Redis
   - Se muito grande: há mensagens antigas
   - Solução: `DEL conversation_id` (cuidado com dados em flight!)

3. **Sub-workflow falhou?**
   - Check: logs do N8N para workflow `QkojhAJKkRHjxsth`
   - Pode ser falha em CLINICA CONSOLE ou timeout

4. **Evolution API erro?**
   - Check: error message na `enviaMensagem` HTTP node
   - Pode ser API key expirada, instance errada, etc.

5. **Postgres query falhou?**
   - Check: `puxaDadosTelefone` ou `salvaMensagemSaida` nodes
   - Pode ser conexão perdida, table não existe, constraint violation

---

## 📊 Tipos de Mensagem Suportados

| Tipo | Handler | Saída |
|------|---------|-------|
| `text` | Direto para Redis | Texto "like-is" |
| `audio` | Whisper transcription | Texto transcrito |
| `image` | gpt-4o-mini analysis | Descrição da imagem |
| `sticker` | gpt-4o-mini analysis | Significado do sticker |
| `document` | PDF extraction | Texto extraído |
| `reaction` | Ignore (noOp) | N/A |
| `conversation` | Ignore (noOp) | N/A |

---

## 🔧 Como Debugar

### 1. Testar Webhook Manualmente
```bash
curl -X POST "https://n8n.example.com/webhook/..." \
  -H "evo-api-key: xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "remoteJid": "+5511987654321",
    "message": "Olá",
    "messageType": "text"
  }'
```

### 2. Inspecionar Redis
```bash
redis-cli
> LRANGE conversation_id 0 -1  # Ver buffer de mensagens
> DEL conversation_id          # Limpar se travado
```

### 3. Inspecionar Postgres
```sql
-- Ver chat paused?
SELECT phone, ai_service, updated_at FROM chats WHERE phone=?;

-- Ver last mensagens
SELECT * FROM chat_messages 
WHERE chat_id = ? 
ORDER BY created_at DESC 
LIMIT 5;

-- Ver se registro foi criado
SELECT * FROM n8n_chat_histories WHERE identifier = phone;
```

### 4. Ver Logs do N8N
- Abrir N8N UI
- Ir para flow `ENTRADA E SAIDA CLINICA`
- Clique em "Executions"
- Ver última execução (sucesso ou erro)

---

## 🧪 Testes Manuais (Se Tiver chatTrigger)

O flow tem um `chatTrigger` node para debug manual (disabled por padrão):

```javascript
// Simula mensagem text
{
  "remoteJid": "+5511987654321",
  "message": "Como funciona agendamento?",
  "messageType": "text"
}

// Simula mensagem audio (base64 encoding)
{
  "remoteJid": "+5511987654321",
  "mediaBase64": "SUQzBAAAAAAAI1NUUVQAAAAOAAAAU2FtcGxlIE1QMyBGaWxlLi4u",
  "messageType": "audio"
}
```

---

## 📈 Performance Notes

- **Debounce timeout:** 2-3 segundos (balanceamento entre latência e spam)
- **OpenAI calls:** 
  - Whisper (audio): ~2-3s latência
  - gpt-4o-mini (image): ~2-4s latência
  - gpt-4.1-mini (format): ~1-2s latência
- **Redis:** local em-memory, rápido (<1ms)
- **Postgres:** queries simples, rápidas (~100-200ms)
- **Total latência:** ~5-15 segundos por mensagem (depende do tipo)

---

## 🔄 Fluxo de Atualização

Se mudar lógica neste flow:

1. Editar JSON localmente OU no N8N UI
2. Testar com webhook manual ou chatTrigger
3. Verificar logs (Executions tab)
4. Se OK: export JSON atualizado de N8N
5. Comittar JSON
6. Se mudou lógica crítica: atualizar este documento

---

**Próxima leitura:**
- Flow 2 detalhes: [FLOW_CLINICA_CONSOLE.md](FLOW_CLINICA_CONSOLE.md)
- Integração: [INTEGRATION.md](INTEGRATION.md)
- Debug: [DEBUG_GUIDE.md](DEBUG_GUIDE.md)
