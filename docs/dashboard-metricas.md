# Dashboard — Guia de Métricas

> Documento de referência para entender o que cada indicador do Painel de Controle mede, como é calculado e como interpretar os valores.

---

## Princípio: universo único

Todas as métricas do dashboard operam sobre o mesmo universo:

> **Chats com `created_at` dentro do período selecionado.**

Isso significa que **"Iniciados pela IA" é o total** sobre o qual todas as outras métricas se referem. Não há mais ambiguidade entre "atividade no período" e "criados no período" — é sempre o mesmo conjunto.

> **Nota sobre o futuro:** hoje todo chat é iniciado pela IA. Quando vier a funcionalidade de "atendente inicia chat", basta filtrar por um campo `initiator = 'ai'` para manter a semântica.

---

## Visão Geral das Abas

| Aba | Período coberto | Filtro adicional |
|---|---|---|
| **Hoje** | Das 00:00 às 23:59 do dia atual | — |
| **Mensal** | Do dia 1 ao último dia do mês selecionado | Selector de mês |
| **Anual** | De 1º de janeiro até **ontem 23:59 (D-1)** | — |

A aba Anual usa **D-1 (fechamento até ontem)** para garantir dados estáveis — não muda durante o dia.

---

## Cards de Gestão

### Aba Hoje — 6 cards

#### 1. Iniciados pela IA
> *"Atendimentos no período"*

**O que mede:** Total de chats criados no período. É o universo.

```sql
WHERE created_at >= $1 AND created_at <= $2
```

---

#### 2. Atendidos só pela IA
> *"Sem transferência para equipe"*

**O que mede:** Chats que ficaram **inteiramente com a IA** e não precisaram ser transferidos para um atendente humano — incluindo finalizados e em andamento. **Não inclui** chats que estão aguardando na fila (esses entram na métrica "Aguardando").

```sql
WHERE created_at no período
  AND assigned_to IS NULL
  AND NOT (status = 'waiting' OR ai_service = 'waiting')
```

---

#### 3. Transferidos para Equipe
> *"Com atendente atribuído"*

**O que mede:** Chats que tiveram um atendente humano atribuído (independente de já estarem finalizados ou ainda em andamento).

```sql
WHERE created_at no período
  AND assigned_to IS NOT NULL
```

> Observação: chats que estão apenas na fila aguardando (sem atendente atribuído) **não contam** aqui.

---

#### 4. Finalizados
> *"Concluídos no período"*

**O que mede:** Total de chats encerrados (`finished = true`). Inclui tanto resolvidos pela IA quanto finalizados pela equipe.

```sql
WHERE created_at no período
  AND finished = true
```

> Card (3) e card (4) podem se sobrepor: um chat transferido E finalizado aparece nos dois. São dimensões diferentes da jornada.

---

#### 5. Aguardando agora *(somente Hoje)*
> *"Fila da equipe (tempo real)"*

**O que mede:** Snapshot do momento — chats que estão **agora** aguardando atendente. **Sem filtro de data.**

```sql
WHERE (finished IS NULL OR finished = false)
  AND (status = 'waiting' OR ai_service = 'waiting')
```

---

#### 6. Sendo atendidos agora *(somente Hoje)*
> *"Equipe operando (tempo real)"*

**O que mede:** Snapshot — chats que estão **agora** sendo atendidos por humanos. **Sem filtro de data.**

```sql
WHERE (finished IS NULL OR finished = false)
  AND (status = 'human' OR ai_service = 'paused')
```

---

### Abas Mensal e Anual — 4 cards

Mostram apenas os cards **1, 2, 3 e 4**. Os snapshots (5 e 6) são estado real-time e não fazem sentido para períodos passados.

---

## Gráfico de Distribuição (Donut)

**O que mostra:** Como os chats iniciados no período se distribuem entre três categorias **mutuamente exclusivas** que representam o funil do atendimento.

| Fatia | Filtro | Cor |
|---|---|---|
| **Atendidos só pela IA** | `assigned_to IS NULL` E não está aguardando | Verde |
| **Aguardando** | `assigned_to IS NULL` E `status='waiting' OR ai_service='waiting'` | Laranja |
| **Atendidos pela Equipe** | `assigned_to IS NOT NULL` | Violeta |

**Garantia matemática:**

```
Atendidos só pela IA + Aguardando + Atendidos pela Equipe = Iniciados pela IA
```

Isso significa:
- O número central do Donut é **exatamente** o card "Iniciados pela IA"
- Os percentuais sempre somam 100%
- Cada fatia bate diretamente com seu card correspondente

---

## Por Atendente

**O que mostra:** Ranking dos atendentes pelos chats que receberam **e foram iniciados no período**.

```sql
WHERE c.created_at >= $1 AND c.created_at <= $2
  AND c.assigned_to = u.id
```

**Colunas exibidas:**

| Coluna | Descrição |
|---|---|
| Total | Chats iniciados no período que foram atribuídos ao atendente |
| `X fin.` | Quantos desses ele finalizou |
| `X transf.` | Quantos foram transferidos externamente |

**Coerência:** A soma dos totais por atendente ≤ card "Transferidos para Equipe". Pode ser menor se um chat foi reatribuído (cada atribuição conta uma vez).

---

## Por Departamento

**O que mostra:** Distribuição de chats iniciados no período por departamento.

```sql
WHERE c.created_at >= $1 AND c.created_at <= $2
  AND c.department_id = d.id
```

Chats sem departamento atribuído não aparecem.

---

## Top Tags do Período

**O que mostra:** As 5 tags mais aplicadas dentro do período.

```sql
WHERE chat_tags.created_at no período
GROUP BY tag
ORDER BY COUNT DESC
LIMIT 5
```

> O filtro usa `chat_tags.created_at` — a data em que a tag foi aplicada — não a data de criação do chat. Uma tag aplicada hoje em um chat antigo conta para o período atual.

---

## Status do Sistema

Indicador fixo que sinaliza se a **instância WhatsApp** (Evolution API) está conectada. Não vem do banco — é um status estático na UI atual.

---

## Resumo: filtros por métrica

| Métrica | Universo | Filtro adicional |
|---|---|---|
| Iniciados pela IA | `created_at` no período | — |
| Atendidos só pela IA | `created_at` no período | `assigned_to IS NULL` E não está aguardando |
| Aguardando (donut) | `created_at` no período | `assigned_to IS NULL` E `status='waiting' OR ai_service='waiting'` |
| Transferidos p/ Equipe | `created_at` no período | `assigned_to IS NOT NULL` |
| Finalizados | `created_at` no período | `finished = true` |
| Aguardando agora | snapshot | `status='waiting' OR ai_service='waiting'` (sem data) |
| Sendo atendidos agora | snapshot | `status='human' OR ai_service='paused'` (sem data) |
| Donut: 3 fatias | `created_at` no período | filtros mutuamente exclusivos (resolvido / transferido / aberto) |
| Por Atendente | `created_at` no período | `assigned_to = user_id` |
| Por Departamento | `created_at` no período | `department_id = dept_id` |
| Top Tags | `chat_tags.created_at` no período | — |

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

*Última atualização: maio de 2026 — modelo de universo único com cards mutuamente exclusivos.*
