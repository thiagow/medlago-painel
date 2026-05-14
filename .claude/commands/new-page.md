# Template: Nova Página no Dashboard

Checklist para criar página em `src/app/dashboard/[recurso]/page.tsx`.

---

## Estrutura Base

```typescript
// src/app/dashboard/[recurso]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Recurso {
  id: string;
  name: string;
  created_at: string;
  // ... outros campos
}

export default function RecursoPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. RBAC: redirect se não autorizado
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // 2. Fetch data on mount
  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/recursos?limit=50&offset=0');
        
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/login');
            return;
          }
          throw new Error('Failed to fetch');
        }

        const { success, data } = await res.json();
        if (!success) throw new Error('API error');
        
        setRecursos(data);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, router]);

  // 3. Loading state
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // 4. Error state
  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-red-900">Erro ao carregar</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // 5. Main content
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Recursos</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Gerencie recursos</p>
      </div>

      {recursos.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-600 dark:text-gray-400">Nenhum recurso encontrado</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {recursos.map((recurso) => (
            <div
              key={recurso.id}
              className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/dashboard/recursos/${recurso.id}`)}
            >
              <h3 className="font-semibold text-gray-900 dark:text-white">{recurso.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Criado em {new Date(recurso.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Estrutura com Formulário (Create/Edit)

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ChevronLeft } from 'lucide-react';

export default function CreateRecursoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validação
    if (!form.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      setLoading(true);

      // 2. POST para API
      const res = await fetch('/api/recursos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const { success, data, error } = await res.json();
      
      if (!success) {
        toast.error(error || 'Erro ao criar');
        return;
      }

      // 3. Sucesso
      toast.success('Criado com sucesso');
      router.push('/dashboard/recursos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button
        onClick={() => router.back()}
        className="mb-6 flex items-center gap-1 text-gray-600 hover:text-gray-900 dark:hover:text-white transition"
      >
        <ChevronLeft className="w-4 h-4" />
        Voltar
      </button>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Novo Recurso</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nome *
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="Ex: Clínica Centro"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition"
        >
          {loading ? 'Salvando...' : 'Criar'}
        </button>
      </form>
    </div>
  );
}
```

---

## Checklist de Segurança

- [ ] Auth verificado (redirect `/login` se não autenticado)
- [ ] RBAC implementado (atendente só vê seu department)
- [ ] Dados sensíveis não expostos no console/logs
- [ ] CSRF token não necessário (Next.js Route Handlers com cookie)
- [ ] XSS protegido (React escapa por padrão)

---

## Checklist de UX

- [ ] Loading state durante fetch (spinner)
- [ ] Error state com mensagem legível
- [ ] Empty state quando lista vazia
- [ ] Toast notifications para ações (sucesso/erro)
- [ ] Disabled buttons durante submit
- [ ] Dark mode suportado (`.dark:` classes)

---

## Checklist de Performance

- [ ] useEffect com dependencies corretas (evitar loops)
- [ ] Fetch apenas uma vez por mount
- [ ] Lazy load se página muito grande (paginação)
- [ ] Images otimizadas (`next/image`)
- [ ] Sem re-renders desnecessários

---

## Padrão: Busca/Filtro

```typescript
const [search, setSearch] = useState('');
const [filtered, setFiltered] = useState<Recurso[]>([]);

useEffect(() => {
  const lowercaseSearch = search.toLowerCase();
  const result = recursos.filter((r) =>
    r.name.toLowerCase().includes(lowercaseSearch) ||
    r.email.toLowerCase().includes(lowercaseSearch)
  );
  setFiltered(result);
}, [search, recursos]);

return (
  <>
    <input
      type="text"
      placeholder="Buscar..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
    />
    {filtered.map((r) => (...))}
  </>
);
```

---

## Padrão: Paginação

```typescript
const [offset, setOffset] = useState(0);
const limit = 20;

useEffect(() => {
  // refetch com novo offset
}, [offset]);

const totalPages = Math.ceil(total / limit);

return (
  <>
    {/* ... lista ... */}
    <div className="flex gap-2 mt-6">
      <button
        disabled={offset === 0}
        onClick={() => setOffset(Math.max(0, offset - limit))}
      >
        Anterior
      </button>
      <span>Página {offset / limit + 1} de {totalPages}</span>
      <button
        disabled={offset + limit >= total}
        onClick={() => setOffset(offset + limit)}
      >
        Próxima
      </button>
    </div>
  </>
);
```

---

## Quando Usar Componentes Customizados

Se UI é específica do domínio (agendamento, broadcast), considere componente `src/components/RecursoCard.tsx`:

```typescript
// src/components/RecursoCard.tsx
export function RecursoCard({ recurso, onSelect }: Props) {
  return (
    <div onClick={onSelect} className="...">
      {/* reusable UI */}
    </div>
  );
}

// Em page.tsx:
import { RecursoCard } from '@/components/RecursoCard';

{recursos.map((r) => <RecursoCard key={r.id} recurso={r} onSelect={() => ...} />)}
```

Não criar componentes para UI genérica (input, button, card simples).
