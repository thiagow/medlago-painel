# Flows: Tools de Agendamento — Sub-workflows da IA

Os 4 sub-workflows invocados pelo `agente_agendador` em CLINICA CONSOLE para operações de agendamento. São chamados via `toolWorkflow` (Execute Workflow node) — nunca acionados diretamente.

---

## Arquitetura Geral

```
CLINICA CONSOLE (agente_agendador)
       │
       ├─ Tool: Tool - Horarios          ← busca slots disponíveis
       │         ↓
       │    igut_horarios_espelho (tabela local)
       │
       ├─ Tool: Tool - Agendamento       ← cria o agendamento
       │         ↓
       │    iGUT API + agendamentos (tabela local)
       │
       ├─ Tool: Tool - Cadastrar Paciente ← registra paciente novo
       │         ↓
       │    iGUT API + pacientes (tabela local)
       │
       └─ Tool: Tool - Busca Agenda       ← consulta agendamentos existentes
                 ↓
            iGUT API (consulta externa)
```

---

## API iGUT — Integração Comum

Todos os 4 tools (exceto Horarios) consomem a API externa iGUT.

**Autenticação:**
- **Client Token:** `bWVkbGFnbw==` (base64 de `"medlago"`) — estático, no header `client_token`
- **Bearer Token:** rotativo, armazenado em `config_tokens` WHERE `service = 'igut_api'`

**Buscar token antes de chamar:**
```sql
SELECT token FROM config_tokens
WHERE service = 'igut_api'
  AND expires_at > NOW()
LIMIT 1;
```

**Base URL iGUT:** `https://api.igut.med.br/v2/`

---

## Tool 1: Tool - Horarios

**Arquivo:** `n8n/flows/Tool - Horarios.json` (5 KB)

### Propósito
Consulta horários disponíveis para um médico em uma janela de datas, usando uma tabela local espelho dos dados do iGUT.

### Input (recebe do agente)
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `nome_medico` | string | Nome do médico (aceita com título Dr./Dra.) |
| `data_inicio` | string | Data inicial no formato DD/MM/YYYY |
| `data_fim` | string | Data final no formato DD/MM/YYYY |
| `nome_convenio` | string | Ignorado na query (passado para compatibilidade) |
| `especialidade` | string | Ignorado na query (passado para compatibilidade) |
| `atendimento_id` | string | Ignorado na query (passado para compatibilidade) |

### Lógica

**1. Query SQL:**
```sql
SELECT horario, nome_medico, data_formatada, status
FROM igut_horarios_espelho
WHERE UNACCENT(UPPER(REGEXP_REPLACE(nome_medico, '(?i)(Dr\.|Dra\.)\s*', '', 'g')))
    = UNACCENT(UPPER(REGEXP_REPLACE('{nome_medico}', '(?i)(Dr\.|Dra\.)\s*', '', 'g')))
  AND data_formatada BETWEEN '{data_inicio}' AND '{data_fim}'
  AND status = 'disponivel'
```

**2. Filtro de slots passados (JavaScript, UTC-3):**
```javascript
const agora = new Date(Date.now() - 3 * 60 * 60 * 1000); // UTC-3
const slotsFuturos = items.filter(item => {
  const slotDate = new Date(`${item.data_iso}T${item.horario}:00-03:00`);
  return slotDate > agora;
});

if (slotsFuturos.length === 0) {
  return [{ mensagem: "Não há horários disponíveis", status: "sem_vagas" }];
}
return slotsFuturos;
```

### Output
```json
// Com slots disponíveis:
[
  { "horario": "10:00", "nome_medico": "Dr. João Silva", "data_formatada": "20/05/2025", "status": "disponivel" },
  { "horario": "14:30", "nome_medico": "Dr. João Silva", "data_formatada": "21/05/2025", "status": "disponivel" }
]

// Sem slots:
{ "mensagem": "Não há horários disponíveis", "status": "sem_vagas" }
```

### Tabelas
- `igut_horarios_espelho` — espelho local dos slots disponíveis (sincronizado com iGUT por processo separado)

### Nenhuma API externa — só banco local

---

## Tool 2: Tool - Agendamento

**Arquivo:** `n8n/flows/Tool - Agendamento.json` (12 KB)

### Propósito
Cria um agendamento: resolve IDs de médico e convênio por nome, garante paciente no banco, chama API iGUT para reservar o slot, e registra localmente.

### Input
| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `nome_medico` | string | ✅ | Nome do médico (títulos são stripped) |
| `nome_convenio` | string | ✅ | Nome do convênio |
| `cpf_paciente` | string | ✅ | CPF (qualquer formato, deve ter 11 dígitos após strip) |
| `data_atendimento` | string | ✅ | Data — aceita DD/MM/YYYY ou YYYY-MM-DD |
| `horario` | string | ✅ | Hora — aceita HH:MM ou HH:MM:SS |
| `tipo_atendimento` | string/int | ✅ | ID do tipo de atendimento |
| `nome_paciente` | string | ✅ | Nome completo do paciente |
| `celular_paciente` | string | ✅ | Telefone (somente dígitos após strip) |
| `data_nascimento` | string | — | Não é gravado pelo flow (passado para compatibilidade) |

### Fluxo Interno

**Passo 1 — Normalizar Dados (JavaScript):**
```javascript
// Validar CPF
const cpf = input.cpf_paciente.replace(/\D/g, '');
if (cpf.length !== 11) throw new Error('CPF inválido');

// Strip título médico
const medico = input.nome_medico.replace(/^(Dr\.|Dra\.)\s*/i, '').trim();

// Normalizar data: DD/MM/YYYY → YYYY-MM-DD
const [d, m, y] = data.split('/');
const dataISO = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;

// Normalizar horário: garantir HH:MM
const horario = input.horario.substring(0, 5);
```

**Passo 2 — Fuzzy match de IDs:**
```sql
SELECT 
  (SELECT id FROM public.profissionais
   WHERE nome <-> '{medico_normalizado}' < 0.8
   ORDER BY nome <-> '{medico_normalizado}' ASC LIMIT 1) AS profissional_id,
  (SELECT id FROM public.convenios
   WHERE nome <-> '{convenio}' < 0.8
   ORDER BY nome <-> '{convenio}' ASC LIMIT 1) AS convenio_id
```

**Passo 3 — Buscar token iGUT:**
```sql
SELECT token FROM config_tokens WHERE service = 'igut_api' AND expires_at > NOW() LIMIT 1
```

**Passo 4 — UPSERT paciente:**
```sql
INSERT INTO pacientes (cpf, nome, telefone)
VALUES ('{cpf}', '{nome}', '{celular}')
ON CONFLICT (cpf) DO UPDATE SET
  nome = CASE 
    WHEN pacientes.nome LIKE 'Paciente %' THEN EXCLUDED.nome 
    ELSE pacientes.nome 
  END,
  telefone = EXCLUDED.telefone
RETURNING cpf, nome
```

**Passo 5 — Chamar iGUT API:**
```http
POST https://api.igut.med.br/v2/callcenters/agendar
client_token: bWVkbGFnbw==
Authorization: Bearer {token}

{
  "profissional": { "id": "{profissional_id}" },
  "convenio": { "id": "{convenio_id}" },
  "atendimento": { "id": "{tipo_atendimento}" },
  "data": "YYYY-MM-DD",
  "horario": "HH:MM",
  "unidade": 1,
  "cpf": "{cpf}"
}
```

**Passo 6 — Gravar agendamento local:**
```sql
INSERT INTO public.agendamentos (
  cpf, medico_id, convenio_id, data_atendimento, horario, tipo_atendimento, status
) VALUES (
  '{cpf}', {profissional_id}, {convenio_id}, '{data}', '{horario}', {tipo}, 'agendado'
)
RETURNING id, cpf, data_atendimento, horario, status
```

### Output
```json
{
  "id": "uuid",
  "cpf": "12345678900",
  "data_atendimento": "2025-05-20",
  "horario": "10:00",
  "status": "agendado"
}
```

### Tabelas
- `public.profissionais` — lookup por nome (trigram `<->`)
- `public.convenios` — lookup por nome (trigram `<->`)
- `config_tokens` — token iGUT rotativo
- `pacientes` — UPSERT (não sobrescreve nome se já cadastrado)
- `public.agendamentos` — INSERT retornando registro criado

---

## Tool 3: Tool - Cadastrar Paciente

**Arquivo:** `n8n/flows/Tool - Cadastrar Paciente.json` (7.6 KB)

### Propósito
Registra um paciente novo (ou atualiza um existente) no banco local e na API iGUT de forma atômica.

### Input
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `nome` | string | Nome completo |
| `cpf` | string | CPF (qualquer formato) |
| `data_nascimento` | string | Data no formato YYYY-MM-DD |
| `celular` | string | Telefone (qualquer formato) |

### Normalização (Set Node)
```
cpf           → strip tudo não-dígito → 11 dígitos
data_nascimento → YYYY-MM-DD → DD/MM/YYYY  (iGUT espera neste formato)
celular       → strip tudo não-dígito
```

### Fluxo

**1. UPSERT no banco local:**
```sql
INSERT INTO pacientes (cpf, nome, telefone, created_at)
VALUES ('{cpf}', '{nome}', '{celular}', NOW())
ON CONFLICT (cpf) DO UPDATE SET
  nome = EXCLUDED.nome,
  telefone = EXCLUDED.telefone
RETURNING 
  cpf, 
  nome,
  CASE WHEN xmax = 0 THEN 'cadastrado' ELSE 'atualizado' END AS status
```

**2. Cadastro na API iGUT:**
```http
POST https://api.igut.med.br/v2/pacientes/
client_token: bWVkbGFnbw==
Authorization: Bearer {token}

{
  "nome": "{nome}",
  "cpf": "{cpf}",
  "datadenascimento": "DD/MM/YYYY",
  "celular": "{celular}"
}
```

Timeout: 10s. `continueOnFail: true` — falha na iGUT não impede resposta ao agente.

### Output
```json
{
  "cpf": "12345678900",
  "nome": "Maria Silva",
  "status": "cadastrado",    // ou "atualizado"
  "mensagem": "Paciente cadastrado com sucesso."
}
```

### Tabelas
- `config_tokens` — token iGUT
- `pacientes` — UPSERT

---

## Tool 4: Tool - Busca Agenda

**Arquivo:** `n8n/flows/Tool - Busca Agenda.json` (3 KB)

### Propósito
Consulta os agendamentos existentes de um paciente diretamente na API iGUT.

### Input
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `cpf_paciente` | string | CPF do paciente |

### Fluxo
1. SELECT token em `config_tokens` WHERE `service = 'igut_api'`
2. POST para iGUT API:

```http
POST https://api.igut.med.br/v2/consultas/buscar
client_token: bWVkbGFnbw==
Authorization: Bearer {token}

{
  "Paciente": { "cpf": "{cpf_paciente}" },
  "Agendamento": {
    "confirmado": 2,
    "status": 3
  }
}
```

### Output
Resposta bruta da API iGUT — lista de consultas do paciente com status confirmado=2 e status=3.

### Tabelas
- `config_tokens` — somente leitura

---

## Tabelas Compartilhadas — Resumo

| Tabela | Tool | Operação |
|--------|------|---------|
| `igut_horarios_espelho` | Horarios | SELECT |
| `public.profissionais` | Agendamento | SELECT (fuzzy match) |
| `public.convenios` | Agendamento | SELECT (fuzzy match) |
| `config_tokens` | Agendamento, Cadastrar Paciente, Busca Agenda | SELECT |
| `pacientes` | Agendamento, Cadastrar Paciente | UPSERT |
| `public.agendamentos` | Agendamento | INSERT |

---

## Debug — Problemas Comuns

### "Médico não foi encontrado"

```sql
-- Ver se médico existe e como está cadastrado
SELECT id, nome FROM public.profissionais 
WHERE UNACCENT(UPPER(nome)) LIKE UNACCENT(UPPER('%{nome_buscado}%'));
```

Se a distância trigram (`<->`) for > 0.8, o fuzzy match falha silenciosamente (retorna NULL).  
**Solução:** Cadastrar o médico com nome mais próximo ao que o usuário fala.

### "Token iGUT expirado"

```sql
-- Ver token atual
SELECT token, expires_at FROM config_tokens WHERE service = 'igut_api';
```

**Se `expires_at < NOW()`:** Token expirou. Renovar na plataforma iGUT e atualizar:
```sql
UPDATE config_tokens SET token = '{novo_token}', expires_at = NOW() + INTERVAL '30 days'
WHERE service = 'igut_api';
```

### "CPF inválido — agendamento rejeitado"

O flow valida CPF com `cpf.length !== 11` após strip. Garanta que o agente passa CPF apenas com dígitos ou no formato padrão (XXX.XXX.XXX-XX).

### "Slot não aparece em Horarios mas médico existe"

1. Verificar tabela espelho: `SELECT * FROM igut_horarios_espelho WHERE nome_medico ILIKE '%{nome}%' LIMIT 10`
2. Se vazio: sincronização com iGUT pode estar desatualizada
3. Verificar processo que sincroniza `igut_horarios_espelho`

---

**Próxima leitura:**
- Como esses tools são chamados: [FLOW_CLINICA_CONSOLE.md](FLOW_CLINICA_CONSOLE.md#sub-agente-2-agente_agendador)
- Debug geral: [DEBUG_GUIDE.md](DEBUG_GUIDE.md)
