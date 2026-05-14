# Arquitetura dos Fluxos N8N — Visão Geral

Visão de 10.000 pés: como os dois fluxos N8N formam o backbone do chatbot clínico MedLago.

---

## 🏗️ Dois Fluxos, Uma Missão

```
WhatsApp Message
       ↓
Evolution API Webhook
       ↓
[ENTRADA E SAIDA CLINICA] ← Flow 1
       ↓
Normaliza + Debounce + Redis buffer
       ↓
Chama sub-workflow
       ↓
[CLINICA CONSOLE] ← Flow 2 (Multi-agente IA)
       ↓
Router Agent
    ├─ FAQ Agent
    ├─ Scheduler Agent
    └─ Procedures Agent
       ↓
SQL Tools (query médicos, preços, agendamentos, etc.)
       ↓
Resposta IA estruturada
       ↓
ENTRADA E SAIDA CLINICA reformata
       ↓
Evolution API POST (texto/imagens/media)
       ↓
WhatsApp Response
```

---

## 🔴 Flow 1: ENTRADA E SAIDA CLINICA (Input/Output Gateway)

**Arquivo:** `flows/ENTRADA_E_SAIDA_CLINICA.json` (92 KB, 50+ nós)

**Propósito:** É a "porta de entrada" do sistema. Recebe mensagens de WhatsApp, as processa, as envia para a IA, recebe a resposta da IA e a envia de volta ao usuário.

### Direções do Fluxo

```
INPUT → Normalize → Fetch Media → Buffer/Debounce → Call IA → OUTPUT
```

**Entrada (INPUT):**
- Webhook POSTs from Evolution API
- Header: `evo-api-key`
- Body: JSON com `remoteJid` (telefone), `message` (conteúdo), `messageType` (text/audio/image/sticker/document)

**Normalização:**
- Extrai número de telefone (`remoteJid`)
- Cria ou atualiza registro `Chat` no Postgres
- Verifica se IA está ativa (`ai_service != 'paused'`)
- Se pausa: registra mensagem e sai (não chama IA)

**Fetch Media (Condicional):**
- Se `messageType` = `audio`: fetch base64 via Evolution API → transcreve com OpenAI Whisper
- Se `messageType` = `image`: fetch base64 → analisa com gpt-4o-mini → extrai descrição
- Se `messageType` = `sticker`: fetch base64 → analisa com gpt-4o-mini
- Se `messageType` = `document`: fetch base64 (PDF) → extrai texto com PDF parser

**Buffer & Debounce:**
- Armazena conteúdo em Redis list (chave: `conversation_id`)
- Wait node: espera 2-3 segundos se mais mensagens chegarem
- Detecta fim do stream: compara Redis antes vs. depois do wait
- Reconstrói mensagem final (junta fragmentos)

**Call IA (Sub-workflow):**
- Chama CLINICA CONSOLE com: `query` (mensagem final), `identifier` (phone), `telefone`
- Recebe resposta JSON com:
  - `mensagem` — texto principal
  - `imagens` — lista de URLs de imagens
  - `acao` — intento (ex: "agendamento_confirmado")

**Saída (OUTPUT):**
- Formata resposta (split textos longos com gpt-4.1-mini)
- Se há imagens: envia em batches (texto + imagem)
- Cria registros `ChatMessage` em Postgres com `direction='outbound'`
- POST via Evolution API para mandar mensagens de volta

### Nós Críticos

| Nó | Tipo | Lógica |
|-----|------|--------|
| `validaPausa` | JS Code | Gate: se `ai_service=='paused'`, para fluxo |
| `reativaBot` | Postgres | Auto-reativa IA se `updated_at` expirou |
| `seExiste` | If | Verifica se IA está ativa |
| `switchTipo` | Switch | Roteia por tipo de mensagem |
| `Redis_lista` | Redis | Armazena fragmentos |
| `Wait` | Wait | Debounce (espera mais mensagens) |
| `reconstrutorMensagemFinal` | JS Code | Junta fragmentos do Redis |
| `acionaMultiagentes` | Execute Workflow | Chama CLINICA CONSOLE |
| `enviaMensagem` | HTTP Request | POST texto/imagem via Evolution API |

### DB Tables (Leitura/Escrita)

- `chats` — lê/escreve: `ai_service`, `status`, `updated_at`
- `chat_messages` — escreve: nova mensagem com `direction='outbound'`

### Outros Storage

- **Redis:** Para debounce buffer por `conversation_id`
- **Credenciais:** Evolution API, OpenAI, Postgres

---

## 🟢 Flow 2: CLINICA CONSOLE (Multi-Agent AI Brain)

**Arquivo:** `flows/CLINICA CONSOLE.json` (123 KB, 80+ nós)

**Propósito:** É o "cérebro" da clínica. Recebe mensagens de pacientes e decide o que fazer: responder FAQ, agendar, transferir para humano, etc. Usa IA com acesso a banco de dados de clínica (médicos, preços, agendamentos).

### Arquitetura de Agentes

```
Entrada: query + identifier + telefone
    ↓
Memory (Postgres chat histories)
    ↓
agente_roteador (Master Agent) ← LLM gpt-4.1-mini
    ├─ Decide: FAQ ou Agendamento ou Especialista?
    ├─ Ou: Encaminha para humano?
    │
    ├─→ agente_faq (Sub-agent)
    │   └─ Tools SQL: médicos, preços, especialidades, exames
    │
    ├─→ agente_agendador (Sub-agent + Think)
    │   └─ Tools: busca slots, cadastra paciente, faz agendamento
    │
    └─→ agente_especialista_procedimentos (Sub-agent)
        └─ Tools: busca procedimentos, protocolos, preparos
    
    ↓
Resposta estruturada JSON
    ↓
Saída para ENTRADA E SAIDA CLINICA
```

### Sub-Agentes

#### `agente_roteador` (Master Router)
- LLM: gpt-4.1-mini (temp 0.7)
- Entrada: `query` (pergunta do paciente)
- Decisão: qual agente chamar ou se transferir para humano
- Tools disponíveis: `agente_faq`, `agente_agendador`, `agente_especialista_procedimentos`, `encaminhar_para_atendente_humano`

#### `agente_faq` (FAQ Agent)
- LLM: gpt-4.1-mini
- Responde perguntas sobre: médicos, preços, planos, especialidades, exames, procedimentos
- SQL Tools: `query_medico`, `query_precos_particular`, `query_precos_convenio`, `query_convenios`, `busca_especialidades`, `query_procedimentos`, `query_exames`

#### `agente_agendador` (Scheduling Agent)
- LLM: gpt-4.1-mini + `toolThink` (permite raciocínio passo-a-passo)
- Orquestra agendamento: busca disponibilidade → registra paciente → faz agendamento → cancela se necessário
- SQL Tools: `busca_paciente`, `query_medico_convenio`, `query_tipo_atendimento`
- External Tools (sub-workflows): `Horarios` (busca slots), `Agendamento` (cria), `Cadastra_Paciente` (registra), `Cancelar` (cancela)

#### `agente_especialista_procedimentos` (Procedures Agent)
- LLM: gpt-4.1-mini
- Responde sobre: procedimentos clínicos, protocolos, preparação para exames
- SQL Tools: `query_procedimentos`, `query_exames`, `busca_preparos`

### Memory

- **Postgres-backed:** Tabela `n8n_chat_histories`
- **Chave:** `identifier` (número de telefone do paciente)
- **Uso:** Agentes lembram da conversa anterior (contexto)

### Transfer para Humano

Quando agente chama `encaminhar_para_atendente_humano`:

```
Webhook enviaMensagemParaEquipe
    ↓
Pausa IA: UPDATE chats SET ai_service='paused'
    ↓
Notifica equipe com resumo da conversa
    ↓
Humano toma conta do chat
```

### SQL Tools Disponíveis

10 ferramentas SQL que agentes podem chamar:

| Tool | Query |
|------|-------|
| `query_medico` | Find doctors by name/specialty |
| `query_precos_particular` | Self-pay prices |
| `query_precos_convenio` | Prices by insurance plan |
| `query_convenios` | List accepted insurance |
| `busca_paciente` | Find patient by CPF/phone |
| `busca_especialidades` | Fuzzy search on specialties |
| `query_procedimentos` | List procedures |
| `query_exames` | List exams |
| `busca_preparos` | Exam prep instructions |
| `query_medico_convenio` | Doctors accepting insurance plan |

### External Sub-Workflows

Agentes chamam via `toolWorkflow` (IDs não neste repo, vivem no N8N server):

- `Horarios` (ID: `Ti15LiLzS3d4MAFF`) — busca slots disponíveis
- `Agendamento` (ID: `EgvLRy83WG3tdPLp`) — cria agendamento
- `Cadastra_Paciente` (ID: `OGFo2N2azQbrX7Ud`) — registra novo paciente
- `Cancelar` (ID: `5luGQufc0ncksRpK`) — cancela agendamento

### Output

Resposta estruturada JSON com campos:
```json
{
  "mensagem": "Olá! Encontrei 3 horários...",
  "imagens": ["url1", "url2"],
  "acao": "agendamento_pendente"
}
```

---

## 🔄 Interação Entre Flows

```
ENTRADA E SAIDA                    CLINICA CONSOLE
   (Flow 1)                          (Flow 2)
      |
      | Webhook WhatsApp
      |
      | Normalize message
      | Store in Redis
      | Debounce wait
      |
      +--→ [Sub-workflow call]
                   |
                   | query + identifier
                   |
                   | Router Agent
                   | ├─ FAQ Agent
                   | ├─ Scheduler Agent
                   | └─ Procedures Agent
                   |
                   | SQL Tools queries
                   |
                   | Return JSON response
                   |
                   +--→ [Response back]
      |
      | Format message
      | Split if long
      |
      | Send via Evolution API
      | Create ChatMessage record
      |
      ↓
   WhatsApp User
```

---

## 📊 Data Stores Used

### Postgres (Shared with Next.js App)

**Chat state:**
- `chats` — conversas ativas
- `chat_messages` — histórico de mensagens
- `n8n_chat_histories` — memória de conversa para IA

**Clinic data:**
- `profissionais`, `especialidades`, `profissional_especialidade`
- `precos`, `convenios`, `profissionais_convenios`
- `tipos_atendimento`, `procedimentos`, `exames`, `preparo_exames`
- `vw_detalhe_consultas` — view para busca rápida de consultas
- `config_tokens` — API keys para serviços externos (iGUT, etc.)

### Redis (N8N Only)

**Per-conversation buffers:**
- Key: `conversation_id`
- Value: List of message fragments during debounce
- Used for: anti-spam, message reconstruction

---

## 🔑 Key Concepts

### Chat States
- `ai` — IA respondendo
- `waiting` — aguardando humano
- `human` — humano respondendo
- `finished` — conversa encerrada
- `transferred_external` — transferida para contato externo

Detalhes: [STATE_MACHINE.md](STATE_MACHINE.md)

### AI Pause
- Quando IA é pausada: `UPDATE chats SET ai_service='paused'`
- Flow 1 detecta: gate `validaPausa` retorna SEM chamar IA
- Mensagens são apenas registradas (não respondidas)
- Humano pode reativar: `UPDATE chats SET ai_service='ai'`

### Debounce Pattern
- Objetivo: não enviar mensagem a IA a cada caractere do usuário
- Implementação: Redis list + Wait node
- Timeout: ~2-3 segundos de silêncio do usuário

---

## ⚠️ Segurança & Compliance

- **API Key hardcoded:** Flow 1 contém Evolution API key em plaintext (SECURITY RISK)
- **PII em Redis:** Fragmentos de mensagem são armazenados em Redis (não ideal para LGPD)
- **Credentials:** OpenAI, Postgres, Redis via N8N Credentials (seguro)

---

## 📈 Performance Considerations

- **Sub-workflows:** Flow 1 → Flow 2 é async, não bloqueante
- **Redis debounce:** reduz 10+ chamadas da IA para 1
- **SQL tools:** direto no banco, sem cache (pode ficar lento se muitos agendamentos)
- **OpenAI calls:** 3 chamadas por mensagem (Whisper, gpt-4o-mini, gpt-4.1-mini) = latência

---

## 🐛 Debugging Rápido

Quando algo não funciona, ler:

- **Mensagem não respondeu?** → [DEBUG_GUIDE.md](DEBUG_GUIDE.md)
- **Transfer não funcionou?** → checar webhook em Flow 2
- **Agendamento falhando?** → Flow 2 agente_agendador + sub-workflow IDs

---

**Próxima leitura:**
- Detalhes do Flow 1: [FLOW_ENTRADA_SAIDA.md](FLOW_ENTRADA_SAIDA.md)
- Detalhes do Flow 2: [FLOW_CLINICA_CONSOLE.md](FLOW_CLINICA_CONSOLE.md)
- Como integra com app: [INTEGRATION.md](INTEGRATION.md)
