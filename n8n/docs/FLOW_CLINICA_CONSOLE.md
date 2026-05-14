# Flow 2: CLINICA CONSOLE — Documentação Detalhada

O "cérebro" do chatbot. Multi-agente IA que decide: responder FAQ, agendar, transferir para humano, etc.

---

## 📋 Info Básica

- **Arquivo:** `flows/CLINICA_CONSOLE.json`
- **Tamanho:** 123 KB
- **Nós:** 80+ (incluindo 30 sticky notes de documentação inline)
- **Entrada:** Sub-workflow call from ENTRADA E SAIDA (query, identifier, telefone)
- **Saída:** JSON estruturado com mensagem + imagens + ação
- **LLM:** gpt-4.1-mini (temp 0.7)
- **Memory:** Postgres (`n8n_chat_histories`)
- **Storage:** SQL tools para clinic data

---

## 🧠 Arquitetura Multi-Agente

```
Entrada: { query, identifier, telefone }
       ↓
memoryPostgresChat (load histórico)
       ↓
agente_roteador (LLM gpt-4.1-mini)
       │
       ├─ Tool: agente_faq → Query clinic data (médicos, preços, etc)
       │
       ├─ Tool: agente_agendador → Schedule appointment
       │  └─ Sub-tools: Horarios, Agendamento, Cadastra_Paciente, Cancelar
       │
       ├─ Tool: agente_especialista_procedimentos → Query procedures
       │
       └─ Tool: encaminhar_para_atendente_humano → Transfer to human
             └─ Webhook: pausa IA, notifica equipe
       
       ↓
Resposta JSON
       ↓
Salva em memory (Postgres chat_histories)
       ↓
Retorna para ENTRADA E SAIDA CLINICA
```

---

## 🚀 Entry Points

### Production: `executeWorkflowTrigger`
- Recebido de ENTRADA E SAIDA CLINICA
- Input: `query`, `identifier`, `telefone`
- Fluxo normal

### Debug: `chatTrigger`
- Para testes manuais no N8N UI
- Input: `query` apenas
- Útil para debugar sem depender de Flow 1

---

## 💾 Memory: Postgres Chat Histories

### Nó: `memoryPostgresChat`
- **Tipo:** @n8n/n8n-nodes-langchain.memoryPostgresChat
- **Table:** `n8n_chat_histories`
- **Key:** `identifier` (phone number)
- **Purpose:** Agentes lembram da conversa anterior
- **Session ID:** `identifier` (um por paciente)

```
[Chat History]
user: "Quanto custa uma consulta?"
assistant: "Uma consulta com clínico geral custa R$ 150..."
user: "Qual é a melhor hora para agendar?"
assistant: "Temos disponibilidade..."
```

---

## 🤖 Agente Roteador (Master Agent)

### Nó: `agente_roteador`
- **Tipo:** @n8n/n8n-nodes-langchain.agent
- **LLM:** gpt-4.1-mini (temp 0.7)
- **Tools disponíveis:**
  - `agente_faq` (sub-agent)
  - `agente_agendador` (sub-agent)
  - `agente_especialista_procedimentos` (sub-agent)
  - `encaminhar_para_atendente_humano` (HTTP tool)

### System Prompt (Implícito)
O roteador analisa a query e decide qual tool chamar:
- "Quanto custa?" → `agente_faq` (prices)
- "Quero agendar" → `agente_agendador` (scheduling)
- "O que é ressonância?" → `agente_especialista_procedimentos` (procedures)
- "Preciso falar com alguém" → `encaminhar_para_atendente_humano` (transfer)

---

## 📌 Sub-Agente 1: `agente_faq` (FAQ Agent)

### Propósito
Responder perguntas gerais sobre clínica: médicos, preços, planos, especialidades, exames, procedimentos.

### Tools SQL Disponíveis

```
agente_faq (LLM gpt-4.1-mini)
  ├─ query_medico
  │  └─ SELECT * FROM profissionais WHERE especialidade ILIKE ?
  ├─ query_precos_particular
  │  └─ SELECT * FROM precos WHERE convenio_id IS NULL
  ├─ query_precos_convenio
  │  └─ SELECT * FROM precos WHERE convenio_id = ?
  ├─ query_convenios
  │  └─ SELECT * FROM convenios WHERE ativo=true
  ├─ busca_especialidades
  │  └─ Fuzzy search em especialidades
  ├─ query_procedimentos
  │  └─ SELECT * FROM procedimentos
  ├─ query_exames
  │  └─ SELECT * FROM exames
  └─ busca_preparos
     └─ SELECT * FROM preparo_exames WHERE exame_id=?
```

### Exemplo de Fluxo
```
User: "Quais médicos fazem cirurgia?"
  ↓
agente_faq recebe query
  ↓
Chama tool: query_medico("cirurgião")
  ↓
SQL returns: Dr. João (cirurgião geral), Dra. Maria (cirurgião vascular), ...
  ↓
LLM formata resposta em português
  ↓
"Temos 2 cirurgiões: Dr. João (geral) e Dra. Maria (vascular)..."
```

---

## 📅 Sub-Agente 2: `agente_agendador` (Scheduling Agent)

### Propósito
Orquestra agendamento completo: busca slots, registra paciente, faz agendamento, cancela.

### Com "Think" Mode
- **Nó:** `toolThink` acoplado a `agente_agendador`
- **Benefício:** Permite agente raciocinar passo-a-passo antes de chamar tools
- "Deixa eu pensar... preciso primeiro buscar os horários, depois cadastrar paciente se novo, depois fazer agendamento..."

### Tools SQL

```
agente_agendador
  ├─ busca_paciente
  │  └─ SELECT FROM vw_detalhe_consultas WHERE cpf=? OR phone=?
  ├─ query_medico_convenio
  │  └─ SELECT FROM profissionais_convenios WHERE convenio_id=?
  ├─ query_tipo_atendimento
  │  └─ SELECT FROM tipos_atendimento
```

### Tools Externos (Sub-workflows)

```
agente_agendador
  ├─ Horarios (workflow ID: Ti15LiLzS3d4MAFF)
  │  └─ Input: médico, data, convenio
  │  └─ Output: lista de slots disponíveis
  ├─ Agendamento (workflow ID: EgvLRy83WG3tdPLp)
  │  └─ Input: paciente_id, medico_id, data_hora, convenio_id
  │  └─ Output: agendamento_id, confirmação
  ├─ Cadastra_Paciente (workflow ID: OGFo2N2azQbrX7Ud)
  │  └─ Input: nome, cpf, telefone, convenio
  │  └─ Output: paciente_id
  └─ Cancelar (workflow ID: 5luGQufc0ncksRpK)
     └─ Input: agendamento_id, motivo
     └─ Output: sucesso/erro
```

### Fluxo de Agendamento

```
User: "Quero agendar com cardiologista para próxima semana"
  ↓
agente_agendador recebe
  ↓
[Think] "Preciso:
  1. Buscar paciente por phone
  2. Buscar slots de cardiologista próxima semana
  3. Se paciente não existe, cadastrar
  4. Fazer agendamento"
  ↓
Chama busca_paciente(telefone)
  └─ Se não encontrado: chama Cadastra_Paciente
  └─ Se encontrado: usa paciente_id
  ↓
Chama Horarios(medico="cardiologista", data="próxima semana")
  └─ Retorna: [seg 10h, seg 14h, ter 09h, ...]
  ↓
LLM formata: "Temos 3 horários..."
  ↓
User escolhe: "Segunda às 10h"
  ↓
Chama Agendamento(paciente_id, medico_id, data_hora, convenio)
  └─ Retorna agendamento_id + confirmação
  ↓
"Pronto! Seu agendamento está confirmado para segunda às 10h com Dr. X"
```

---

## 🔬 Sub-Agente 3: `agente_especialista_procedimentos` (Procedures Agent)

### Propósito
Responder sobre procedimentos clínicos, protocolos, exames especiais.

### Tools SQL

```
agente_especialista_procedimentos
  ├─ query_procedimentos
  │  └─ Procedimentos disponíveis (injeções, protocolos, etc)
  ├─ query_exames
  │  └─ Exames disponíveis
  └─ busca_preparos
     └─ Instruções de prep para exames ("jejum de 8h", etc)
```

### Exemplo

```
User: "Como é uma ressonância? Preciso de jejum?"
  ↓
agente_especialista_procedimentos
  ↓
Chama query_exames("ressonância")
  ↓
Chama busca_preparos(exame_id)
  └─ Retorna: "Jejum de 4h, remover piercings, roupas sem metal"
  ↓
"Ressonância magnética é um exame seguro que gera imagens... 
Você precisa fazer jejum de 4h antes..."
```

---

## 🚀 Transfer para Humano

### Nó: `encaminhar_para_atendente_humano`
- **Tipo:** HTTP Tool
- **Endpoint:** `https://autowebhook.tiait.com.br/webhook/recebe-input-encaminhado-clinica`
- **Trigger:** Quando agente decide que precisa de humano
- **Payload:**
  ```json
  {
    "whatsapp": "+55 11 9 8765-4321",
    "resumo": "Paciente questiona política de reembolso...",
    "motivo": "necessita_atendente_humano"
  }
  ```

### After Transfer

**Webhook Receiver:** `webhookRecebeTransferencia`
- Recebe POST acima
- Prepara dados
- Pausa IA: `UPDATE chats SET ai_service='paused', updated_at=NOW()+ interval...`
- Notifica equipe: envia WhatsApp para team com link do chat + resumo
- Espera humano tomar conta

---

## 📤 Output Structure

Após agentes processarem, output é JSON:

```json
{
  "mensagem": "Olá! Encontrei 3 horários disponíveis...",
  "imagens": [
    "https://r2.example.com/calendario_cardiologia.png"
  ],
  "acao": "agendamento_pendente"
}
```

### `mensagem`
Texto principal em português (pode ter quebras de linha)

### `imagens`
Array de URLs (pode ser vazio)
- Usadas pelo Flow 1 para enviar como imagens anexadas

### `acao`
Intent indicator:
- `"faq_respondida"` — pergunta comum respondida
- `"agendamento_confirmado"` — agendamento feito
- `"agendamento_pendente"` — aguardando confirmação
- `"transferencia_humano"` — encaminhado para atendente
- `"erro_agendamento"` — falha no agendamento

---

## 🗄️ Database Tables

### SQL Tools Acessam

| Tabela | Tool | Query Típica |
|--------|------|--------------|
| `profissionais` | query_medico | SELECT WHERE especialidade ILIKE |
| `especialidades` | busca_especialidades | Fuzzy search |
| `precos` | query_precos_* | SELECT WHERE convenio_id |
| `convenios` | query_convenios | SELECT WHERE ativo=true |
| `procedimentos` | query_procedimentos | SELECT * |
| `exames` | query_exames | SELECT * |
| `preparo_exames` | busca_preparos | SELECT WHERE exame_id |
| `profissional_especialidade` | (interno) | JOINs |
| `vw_detalhe_consultas` | busca_paciente | SELECT WHERE cpf/phone |
| `config_tokens` | (para iGUT API) | SELECT WHERE service='igut_api' |
| `n8n_chat_histories` | memory | SELECT/INSERT chat history |

---

## 🔑 Key Concepts

### Identifier (Session Key)
- **Value:** Phone number do paciente
- **Use:** Memory keying, tracking conversation
- **Persistent:** Mesma pessoa, mesma memória de conversa

### Think Mode
- **Apenas em `agente_agendador`**
- **Benefício:** Agente planeja antes de executar
- Evita wrong tool calls
- Melhor para fluxos complexos

### Sub-Workflows Externos
- `Horarios`, `Agendamento`, `Cadastra_Paciente`, `Cancelar`
- **Não estão neste repo** — vivem no servidor N8N
- IDs são referências hardcoded
- Se falhar: flow 2 retorna erro, flow 1 processa gracefully

---

## ⚠️ Pontos de Falha Comuns

### "Agendamento não funcionou"
1. Sub-workflow `Agendamento` falhou (não neste repo)
2. Paciente não estava cadastrado e `Cadastra_Paciente` falhou
3. Slot estava indisponível
4. Convenio inválido

### "Transfer para humano não disparou webhook"
1. Agente não chamou `encaminhar_para_atendente_humano`
2. Webhook URL está errada em HTTP Tool node
3. N8N não tem conectividade externa

### "Agente "esquece" histórico"
1. `identifier` está diferente (phone format mismatch)
2. Tabela `n8n_chat_histories` foi limpa
3. Sessão expirou (older than 30 days)

### "SQL tool retorna vazio"
1. Dados não existem no banco
2. Query tem erro de sintaxe
3. Credencial Postgres expirou/desconectou

---

## 🧪 Testes Manuais (chatTrigger)

Se debug node `chatTrigger` estiver ativo:

```javascript
// FAQ query
{
  "query": "Qual é o valor de uma consulta com cardiologista?",
  "identifier": "+55 11 98765-4321",
  "telefone": "+55 11 98765-4321"
}

// Scheduling query
{
  "query": "Quero agendar com o Dr. João cardiologista para próxima semana",
  "identifier": "+55 11 98765-4321",
  "telefone": "+55 11 98765-4321"
}

// Procedures query
{
  "query": "Quanto tempo dura uma ressonância? Preciso fazer jejum?",
  "identifier": "+55 11 98765-4321",
  "telefone": "+55 11 98765-4321"
}
```

---

## 📈 Performance Notes

- **Memory load:** ~100ms (Postgres query)
- **LLM calls:** ~2-5s per agent (gpt-4.1-mini)
- **SQL tools:** ~100-500ms (depend on data size)
- **Sub-workflows:** ~1-5s each (Horarios, Agendamento)
- **Total:** ~5-20s per query

---

## 🔄 Fluxo de Atualização

Se mudar agente, tools, ou prompts:

1. Editar no N8N UI (mais fácil) ou JSON
2. Testar com `chatTrigger` (debug entry point)
3. Ver logs das execuções
4. Se OK: export JSON
5. Commitar JSON
6. Atualizar este documento se mudou lógica crítica

---

**Próxima leitura:**
- Integração com app: [INTEGRATION.md](INTEGRATION.md)
- Debug: [DEBUG_GUIDE.md](DEBUG_GUIDE.md)
