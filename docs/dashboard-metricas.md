# Dashboard — Guia de Métricas

> **Documento de referência** para entender o que cada indicador do Painel de Controle mede, como é calculado e como interpretar os valores.

---

## Visão Geral

O Dashboard está organizado em **3 abas de período**:

| Aba | Período coberto | Filtro adicional |
|---|---|---|
| **Hoje** | Das 00:00 às 23:59 do dia atual | — |
| **Mensal** | Do dia 1 ao último dia do mês selecionado | Selector de mês (meses anteriores ao atual) |
| **Anual** | De 1º de janeiro a 31 de dezembro do ano atual | — |

Todas as métricas se ajustam automaticamente ao período da aba ativa.

---

## Cards de Status (6 indicadores)

### 1. Atendimentos IA
> **"Com atividade no período"**

**O que mede:** Quantidade de conversas que estão **em andamento pela IA** e tiveram alguma atividade (criação ou atualização de registro) dentro do período selecionado.

**Como é calculado:**
```sql
WHERE finished IS NULL OR finished = false        -- chat ainda não finalizado
  AND status NOT IN ('finished', 'transferred_external')
  AND ai_service NOT IN ('waiting', 'paused')     -- IA está ativa (não pausada)
  AND (created_at OU updated_at dentro do período)
```

**Observação importante:** Inclui tanto chats **abertos hoje** quanto chats **abertos em dias anteriores** que receberam uma mensagem ou atualização dentro do período. Por isso, pode ser maior que o "Total Registrado" em dias com muito reengajamento de conversas antigas.

---

### 2. Aguardando
> **"Fila da equipe"**

**O que mede:** Conversas em que a IA identificou necessidade de atendimento humano e estão **aguardando que um atendente assuma**, com atividade no período.

**Como é calculado:**
```sql
WHERE finished IS NULL OR finished = false
  AND (status = 'waiting' OU ai_service = 'waiting')
  AND (created_at OU updated_at dentro do período)
```

**Leitura prática:** Esse número representa a fila de espera. Um valor alto indica gargalo no atendimento humano.

---

### 3. Atendimento Equipe
> **"Agentes operando"**

**O que mede:** Conversas que estão **sendo atendidas ativamente por um agente humano** no momento, com atividade no período.

**Como é calculado:**
```sql
WHERE finished IS NULL OR finished = false
  AND (status = 'human' OU ai_service = 'paused')
  AND (created_at OU updated_at dentro do período)
```

**Leitura prática:** Reflete a carga operacional atual da equipe de atendimento.

---

### 4. Finalizados
> **"Concluídos no período"**

**O que mede:** Conversas que foram **marcadas como concluídas** (campo `finished = true`) dentro do período selecionado.

**Como é calculado:**
```sql
WHERE finished = true
  AND updated_at dentro do período
```

**Observação:** O filtro usa `updated_at` (data da última atualização), que é quando o chat foi efetivamente finalizado. Isso significa que **um chat iniciado ontem e finalizado hoje** conta como finalizado hoje — comportamento intencional para medir a produtividade do dia.

---

### 5. Total Equipe
> **"Passaram pela equipe"**

**O que mede:** Total de conversas que tiveram **algum contato humano** (foram atribuídas a um atendente ou finalizadas por um humano) e tiveram atividade no período.

**Como é calculado:**
```sql
WHERE (assigned_to IS NOT NULL OR finished_by IS NOT NULL)
  AND (created_at OU updated_at dentro do período)
```

**Diferença em relação a "Atendimento Equipe":** "Atendimento Equipe" é o snapshot atual (em andamento agora). "Total Equipe" é o acumulado do período (todos que passaram, incluindo já finalizados).

---

### 6. Total Registrado
> **"Iniciados no período"**

**O que mede:** Quantidade de conversas **criadas** (primeiro contato) dentro do período selecionado.

**Como é calculado:**
```sql
WHERE created_at dentro do período
```

**Leitura prática:** É o volume de entrada — quantos pacientes/contatos iniciaram uma nova conversa naquele período. É a métrica base de demanda.

---

## Por que "Total Registrado" pode ser menor que a soma dos outros cards?

Essa é a dúvida mais comum. A explicação:

| Card | Filtro base |
|---|---|
| IA + Aguardando + Equipe + Finalizados | Atividade no período (`created_at` **OU** `updated_at`) |
| **Total Registrado** | Criados no período (`created_at` apenas) |

**Exemplo:** Em um dia com 8 novos chats (Total = 8), podem ter chegado mensagens em 4 chats antigos (de dias anteriores), totalizando 12 ativos com atividade hoje. O resultado aparente seria `IA=12, Total=8` — não é um erro, são medidas diferentes.

---

## Gráfico de Distribuição (Donut)

**O que mostra:** Proporção visual entre os 4 status ativos no período: IA, Aguardando, Equipe e Finalizados.

**Como os percentuais são calculados:**
```
% de cada status = valor do status ÷ (IA + Aguardando + Equipe + Finalizados) × 100
```

O número no centro do donut é a **soma total dos 4 valores**. Os percentuais sempre somam 100%.

> **Nota:** O denominador é a soma dos 4 valores exibidos — e não o "Total Registrado" — para garantir que os percentuais sejam sempre coerentes.

---

## Por Atendente

**O que mostra:** Ranking dos atendentes por volume de conversas que tiveram **atividade no período** e estavam ou estão sob responsabilidade deles.

**Como é calculado:** Para cada atendente com chats vinculados (`assigned_to`):

```sql
WHERE (
    -- Chats ativos com atividade no período
    (finished IS NULL OR finished = false)
    AND (created_at OU updated_at dentro do período)
)
OR (
    -- Chats finalizados no período
    finished = true AND updated_at dentro do período
)
```

**Colunas exibidas:**
| Coluna | Descrição |
|---|---|
| Total (número grande) | Soma de ativos + finalizados no período |
| `X fin.` | Quantos ele finalizou no período |
| `X transf.` | Quantos foram transferidos externamente |

**Por que o total de um atendente pode não bater com o total geral?** Porque um mesmo chat pode ter passado por mais de um atendente (reatribuições), sendo contado para cada um. O total geral é de chats únicos; o ranking é por atribuição.

---

## Por Departamento

**O que mostra:** Distribuição de conversas por departamento, com a mesma lógica de período aplicada ao "Por Atendente".

**Como é calculado:**
```sql
-- Mesmo critério de período do "Por Atendente"
-- Agrupa por department_id (via JOIN departments)
```

**Observação:** Chats sem departamento atribuído não aparecem neste painel.

---

## Top Tags do Período

**O que mostra:** As 5 tags mais utilizadas para categorizar conversas dentro do período.

**Como é calculado:**
```sql
WHERE chat_tags.created_at dentro do período
GROUP BY tag
ORDER BY COUNT DESC
LIMIT 5
```

**Diferença de período:** O filtro usa `chat_tags.created_at` — a data em que a tag foi aplicada à conversa, não a data de criação do chat. Uma tag aplicada hoje em um chat antigo conta para o período atual.

---

## Status do Sistema

Indicador fixo que sinaliza se a **instância WhatsApp** (Evolution API) está conectada e operacional. Não é calculado a partir do banco de dados — é um status estático na UI atual.

---

## Resumo dos Filtros por Métrica

| Métrica | Filtro de data | Campo usado |
|---|---|---|
| IA / Aguardando / Equipe (cards) | `created_at` OU `updated_at` no período | Chats ativos |
| Finalizados | `updated_at` no período | `finished = true` |
| Total Registrado | `created_at` no período | Todos os chats |
| Total Equipe | `created_at` OU `updated_at` no período | Com `assigned_to` ou `finished_by` |
| Por Atendente | `created_at` OU `updated_at` no período | Ativos + finalizados no período |
| Por Departamento | `created_at` OU `updated_at` no período | Ativos + finalizados no período |
| Top Tags | `created_at` no período | `chat_tags.created_at` |

---

## Glossário de Status de Chat

| Status | Descrição |
|---|---|
| `ai` | IA respondendo ativamente |
| `waiting` | Aguardando atendente humano |
| `human` / `paused` | Atendente humano assumiu |
| `finished` | Conversa encerrada |
| `transferred_external` | Transferida para canal externo |

---

*Última atualização: maio de 2026 — reflete as queries de `dashboard-today`, `dashboard-month` e `dashboard-annual` após correção das divergências de período.*
