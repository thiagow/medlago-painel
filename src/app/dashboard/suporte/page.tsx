"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
    LifeBuoy,
    Plus,
    ChevronLeft,
    ChevronRight,
    Search,
    X,
    Filter,
    Loader2,
    AlertCircle,
    Bug,
    Wrench,
    Lightbulb,
    HelpCircle,
    Image,
    Link2,
    Ticket,
    Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TicketItem {
    id: string;
    ticket_number: string;
    titulo: string;
    tipo: string;
    prioridade: string;
    status: string;
    created_at: string;
    created_by: string;
    creator_name: string;
    respostas: number;
}

interface Pagination {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

interface UserOption {
    id: string;
    name: string;
}

// ─── Badge helpers ─────────────────────────────────────────────────────────────

function statusBadge(status: string) {
    const map: Record<string, string> = {
        aberto:       "bg-blue-500/15 text-blue-300 border-blue-500/30",
        em_andamento: "bg-amber-500/15 text-amber-300 border-amber-500/30",
        finalizado:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
        cancelado:    "bg-slate-500/15 text-slate-400 border-slate-500/30",
    };
    const labels: Record<string, string> = {
        aberto: "Aberto", em_andamento: "Em andamento", finalizado: "Finalizado", cancelado: "Cancelado",
    };
    return { cls: map[status] ?? "bg-slate-500/15 text-slate-400", label: labels[status] ?? status };
}

function prioridadeBadge(p: string) {
    const map: Record<string, string> = {
        baixa:  "bg-slate-500/15 text-slate-400 border-slate-500/30",
        media:  "bg-blue-500/15 text-blue-300 border-blue-500/30",
        alta:   "bg-orange-500/15 text-orange-300 border-orange-500/30",
        critica:"bg-red-500/15 text-red-300 border-red-500/30",
    };
    const labels: Record<string, string> = {
        baixa: "Baixa", media: "Média", alta: "Alta", critica: "Crítica",
    };
    return { cls: map[p] ?? "bg-slate-500/15 text-slate-400", label: labels[p] ?? p };
}

function TipoIcon({ tipo, className = "w-3.5 h-3.5" }: { tipo: string; className?: string }) {
    const icons: Record<string, React.ElementType> = {
        bug:      Bug,
        erro:     AlertCircle,
        melhoria: Lightbulb,
        duvida:   HelpCircle,
    };
    const colors: Record<string, string> = {
        bug:      "text-red-400",
        erro:     "text-orange-400",
        melhoria: "text-blue-400",
        duvida:   "text-violet-400",
    };
    const Icon = icons[tipo] ?? Ticket;
    return <Icon className={`${className} ${colors[tipo] ?? "text-slate-400"}`} />;
}

// ─── Modal de Criação ──────────────────────────────────────────────────────────

const TIPOS = [
    { value: "bug",      label: "Bug",      icon: Bug,         color: "text-red-400" },
    { value: "erro",     label: "Erro",     icon: AlertCircle, color: "text-orange-400" },
    { value: "melhoria", label: "Melhoria", icon: Lightbulb,   color: "text-blue-400" },
    { value: "duvida",   label: "Dúvida",   icon: HelpCircle,  color: "text-violet-400" },
];

const PRIORIDADES = [
    { value: "baixa",   label: "Baixa",    color: "text-slate-400" },
    { value: "media",   label: "Média",    color: "text-blue-400" },
    { value: "alta",    label: "Alta",     color: "text-orange-400" },
    { value: "critica", label: "Crítica",  color: "text-red-400" },
];

interface NovoTicketForm {
    titulo: string;
    descricao: string;
    tipo: string;
    prioridade: string;
    video_url: string;
    imagens: File[];
}

function CriarTicketModal({
    onClose,
    onSuccess,
}: {
    onClose: () => void;
    onSuccess: (ticket: TicketItem) => void;
}) {
    const [form, setForm] = useState<NovoTicketForm>({
        titulo: "", descricao: "", tipo: "", prioridade: "media", video_url: "", imagens: [],
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [previews, setPreviews] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImagens = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(e.target.files ?? []);
        const combined = [...form.imagens, ...selected].slice(0, 5);
        setForm(f => ({ ...f, imagens: combined }));
        setPreviews(combined.map(f => URL.createObjectURL(f)));
    };

    const removeImagem = (idx: number) => {
        const updated = form.imagens.filter((_, i) => i !== idx);
        setForm(f => ({ ...f, imagens: updated }));
        setPreviews(updated.map(f => URL.createObjectURL(f)));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!form.tipo) { setError("Selecione o tipo do chamado"); return; }
        if (!form.titulo.trim() || form.titulo.trim().length < 5) { setError("Título deve ter ao menos 5 caracteres"); return; }
        if (!form.descricao.trim() || form.descricao.trim().length < 10) { setError("Descrição deve ter ao menos 10 caracteres"); return; }

        setSaving(true);
        try {
            const fd = new FormData();
            fd.append("titulo",     form.titulo.trim());
            fd.append("descricao",  form.descricao.trim());
            fd.append("tipo",       form.tipo);
            fd.append("prioridade", form.prioridade);
            if (form.video_url.trim()) fd.append("video_url", form.video_url.trim());
            form.imagens.forEach(img => fd.append("imagens", img));

            const res = await fetch("/api/suporte", { method: "POST", body: fd });
            const json = await res.json();

            if (!res.ok) { setError(json.error ?? "Erro ao criar chamado"); return; }

            onSuccess(json.data);
        } catch {
            setError("Erro de conexão. Tente novamente.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800 shrink-0">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <LifeBuoy className="w-5 h-5 text-blue-400" />
                        Abrir Chamado
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="p-6 overflow-y-auto space-y-5 flex-1">
                        {error && (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Tipo */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                Tipo <span className="text-red-400">*</span>
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {TIPOS.map(t => {
                                    const Icon = t.icon;
                                    const active = form.tipo === t.value;
                                    return (
                                        <button
                                            key={t.value}
                                            type="button"
                                            onClick={() => setForm(f => ({ ...f, tipo: t.value }))}
                                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                                                active
                                                    ? "bg-blue-600 border-blue-500 text-white"
                                                    : "bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800"
                                            }`}
                                        >
                                            <Icon className={`w-4 h-4 ${active ? "text-white" : t.color}`} />
                                            {t.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Prioridade */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                Prioridade <span className="text-red-400">*</span>
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {PRIORIDADES.map(p => {
                                    const active = form.prioridade === p.value;
                                    return (
                                        <button
                                            key={p.value}
                                            type="button"
                                            onClick={() => setForm(f => ({ ...f, prioridade: p.value }))}
                                            className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                                                active
                                                    ? "bg-blue-600 border-blue-500 text-white"
                                                    : "bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800"
                                            }`}
                                        >
                                            <span className={active ? "text-white" : p.color}>{p.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Título */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                Título <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.titulo}
                                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                                placeholder="Descreva o problema em poucas palavras..."
                                maxLength={255}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>

                        {/* Descrição */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                Descrição <span className="text-red-400">*</span>
                            </label>
                            <textarea
                                value={form.descricao}
                                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                                placeholder="Descreva o problema em detalhes: o que aconteceu, quando, como reproduzir..."
                                rows={5}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                            />
                        </div>

                        {/* URL de Vídeo */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                URL de Vídeo <span className="text-slate-600 font-normal normal-case">(opcional — Loom, YouTube, Drive…)</span>
                            </label>
                            <div className="relative">
                                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="url"
                                    value={form.video_url}
                                    onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))}
                                    placeholder="https://..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        </div>

                        {/* Upload de Imagens */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                Imagens <span className="text-slate-600 font-normal normal-case">(opcional — máx. 5 × 5 MB, JPG/PNG/WebP/GIF)</span>
                            </label>

                            {form.imagens.length < 5 && (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-300 transition-colors text-sm"
                                >
                                    <Image className="w-5 h-5" />
                                    Clique para adicionar imagens
                                </button>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                onChange={handleImagens}
                                className="hidden"
                            />

                            {previews.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {previews.map((src, i) => (
                                        <div key={i} className="relative group">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={src}
                                                alt={`preview-${i}`}
                                                className="w-20 h-20 object-cover rounded-xl border border-slate-700"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeImagem(i)}
                                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-60"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <LifeBuoy className="w-4 h-4" />}
                            {saving ? "Enviando…" : "Abrir Chamado"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Página Principal ──────────────────────────────────────────────────────────

export default function SuportePage() {
    const { user, isAdmin } = useAuth();
    const router = useRouter();
    const admin = isAdmin();

    const [tickets, setTickets]     = useState<TicketItem[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 50, totalPages: 1 });
    const [loading, setLoading]     = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [users, setUsers]         = useState<UserOption[]>([]);

    // Filtros (admin)
    const [filterStatus,     setFilterStatus]     = useState("");
    const [filterPrioridade, setFilterPrioridade] = useState("");
    const [filterTipo,       setFilterTipo]       = useState("");
    const [filterUser,       setFilterUser]       = useState("");
    const [filterDateFrom,   setFilterDateFrom]   = useState("");
    const [filterDateTo,     setFilterDateTo]     = useState("");
    const [showFilters,      setShowFilters]      = useState(false);
    const [page, setPage] = useState(1);

    const fetchTickets = useCallback(async (p = page) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(p), limit: "50" });
            if (filterStatus)     params.set("status",     filterStatus);
            if (filterPrioridade) params.set("prioridade", filterPrioridade);
            if (filterTipo)       params.set("tipo",       filterTipo);
            if (filterUser)       params.set("created_by", filterUser);
            if (filterDateFrom)   params.set("date_from",  filterDateFrom);
            if (filterDateTo)     params.set("date_to",    filterDateTo);

            const res = await fetch(`/api/suporte?${params}`, { cache: "no-store" });
            if (res.ok) {
                const json = await res.json();
                setTickets(json.data ?? []);
                setPagination(json.pagination);
            }
        } catch (err) {
            console.error("Erro ao buscar tickets:", err);
        } finally {
            setLoading(false);
        }
    }, [page, filterStatus, filterPrioridade, filterTipo, filterUser, filterDateFrom, filterDateTo]);

    useEffect(() => { fetchTickets(1); setPage(1); }, [filterStatus, filterPrioridade, filterTipo, filterUser, filterDateFrom, filterDateTo]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { fetchTickets(page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

    // Carregar lista de usuários para o filtro admin
    useEffect(() => {
        if (!admin) return;
        fetch("/api/users/list", { cache: "no-store" })
            .then(r => r.json())
            .then(j => setUsers((j.data ?? []).map((u: { id: string; name: string }) => ({ id: String(u.id), name: u.name }))))
            .catch(() => {});
    }, [admin]);

    const handleClearFilters = () => {
        setFilterStatus(""); setFilterPrioridade(""); setFilterTipo("");
        setFilterUser(""); setFilterDateFrom(""); setFilterDateTo("");
    };

    const hasFilters = !!(filterStatus || filterPrioridade || filterTipo || filterUser || filterDateFrom || filterDateTo);

    const [confirmDelete, setConfirmDelete] = useState<{ id: string; ticket_number: string } | null>(null);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (!confirmDelete) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/suporte/${confirmDelete.id}`, { method: "DELETE" });
            if (res.ok) {
                setTickets(prev => prev.filter(t => t.id !== confirmDelete.id));
                setConfirmDelete(null);
            }
        } catch (err) {
            console.error("Erro ao excluir ticket:", err);
        } finally {
            setDeleting(false);
        }
    };

    const handleTicketCreated = (ticket: TicketItem) => {
        setShowModal(false);
        // Navega direto para o detalhe
        router.push(`/dashboard/suporte/${ticket.id}`);
    };

    const selectCls = "bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500 transition-colors";
    const inputCls  = "bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500 transition-colors";

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto h-full">

            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shrink-0">
                            <LifeBuoy className="w-5 h-5 text-white" />
                        </div>
                        Suporte
                    </h1>
                    <p className="text-slate-400 text-sm mt-1 ml-12">
                        {admin ? "Gestão de chamados" : "Meus chamados"}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {admin && (
                        <button
                            onClick={() => setShowFilters(v => !v)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition-all ${
                                showFilters || hasFilters
                                    ? "bg-blue-600 border-blue-500 text-white"
                                    : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700"
                            }`}
                        >
                            <Filter className="w-4 h-4" />
                            Filtros
                            {hasFilters && (
                                <span className="w-2 h-2 rounded-full bg-white/80 ml-0.5" />
                            )}
                        </button>
                    )}
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Abrir Chamado
                    </button>
                </div>
            </div>

            {/* Filtros admin */}
            {admin && showFilters && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectCls}>
                            <option value="">Todos os status</option>
                            <option value="aberto">Aberto</option>
                            <option value="em_andamento">Em andamento</option>
                            <option value="finalizado">Finalizado</option>
                            <option value="cancelado">Cancelado</option>
                        </select>
                        <select value={filterPrioridade} onChange={e => setFilterPrioridade(e.target.value)} className={selectCls}>
                            <option value="">Toda prioridade</option>
                            <option value="baixa">Baixa</option>
                            <option value="media">Média</option>
                            <option value="alta">Alta</option>
                            <option value="critica">Crítica</option>
                        </select>
                        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className={selectCls}>
                            <option value="">Todo tipo</option>
                            <option value="bug">Bug</option>
                            <option value="erro">Erro</option>
                            <option value="melhoria">Melhoria</option>
                            <option value="duvida">Dúvida</option>
                        </select>
                        <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className={selectCls}>
                            <option value="">Todos os usuários</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                        <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className={inputCls} title="Data início" />
                        <input type="date" value={filterDateTo}   onChange={e => setFilterDateTo(e.target.value)}   className={inputCls} title="Data fim" />
                    </div>
                    {hasFilters && (
                        <button onClick={handleClearFilters} className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
                            <X className="w-3.5 h-3.5" /> Limpar filtros
                        </button>
                    )}
                </div>
            )}

            {/* Tabela */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-7 h-7 text-slate-600 animate-spin" />
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <LifeBuoy className="w-12 h-12 text-slate-700 mb-3" />
                        <p className="text-slate-400 font-medium">Nenhum chamado encontrado</p>
                        <p className="text-slate-600 text-sm mt-1">
                            {hasFilters ? "Tente ajustar os filtros" : "Clique em \"Abrir Chamado\" para criar o primeiro"}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-800">
                                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ticket</th>
                                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Título</th>
                                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Tipo</th>
                                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Prioridade</th>
                                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                        {admin && (
                                            <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Criado por</th>
                                        )}
                                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Data</th>
                                        {admin && <th className="w-10" />}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tickets.map(t => {
                                        const sb = statusBadge(t.status);
                                        const pb = prioridadeBadge(t.prioridade);
                                        return (
                                            <tr
                                                key={t.id}
                                                onClick={() => router.push(`/dashboard/suporte/${t.id}`)}
                                                className="border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition-colors group"
                                            >
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <span className="text-xs font-mono font-semibold text-blue-400 group-hover:text-blue-300">
                                                        {t.ticket_number}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <TipoIcon tipo={t.tipo} />
                                                        <span className="text-sm text-slate-200 truncate max-w-[240px]">{t.titulo}</span>
                                                        {t.respostas > 0 && (
                                                            <span className="text-[10px] bg-slate-700 text-slate-400 rounded-full px-1.5 py-0.5 shrink-0">
                                                                {t.respostas}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 hidden md:table-cell">
                                                    <span className="text-xs text-slate-400 capitalize">{t.tipo === "duvida" ? "Dúvida" : t.tipo.charAt(0).toUpperCase() + t.tipo.slice(1)}</span>
                                                </td>
                                                <td className="px-5 py-4 hidden lg:table-cell">
                                                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${pb.cls}`}>{pb.label}</span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${sb.cls}`}>{sb.label}</span>
                                                </td>
                                                {admin && (
                                                    <td className="px-5 py-4 hidden lg:table-cell">
                                                        <span className="text-xs text-slate-400">{t.creator_name}</span>
                                                    </td>
                                                )}
                                                <td className="px-5 py-4 hidden md:table-cell">
                                                    <span className="text-xs text-slate-500">
                                                        {format(new Date(t.created_at), "dd/MM/yyyy", { locale: ptBR })}
                                                    </span>
                                                </td>
                                                {admin && (
                                                    <td className="px-3 py-4" onClick={e => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => setConfirmDelete({ id: t.id, ticket_number: t.ticket_number })}
                                                            className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                                                            title="Excluir ticket"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Paginação */}
                        {pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between px-5 py-4 border-t border-slate-800">
                                <span className="text-xs text-slate-500">
                                    {pagination.total} chamado{pagination.total !== 1 ? "s" : ""}
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page <= 1}
                                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-40 transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-xs text-slate-400 px-2">
                                        {page} / {pagination.totalPages}
                                    </span>
                                    <button
                                        onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                        disabled={page >= pagination.totalPages}
                                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-40 transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modal de confirmação de exclusão */}
            {confirmDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl mx-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                                <Trash2 className="w-4 h-4 text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-white">Excluir ticket</h3>
                                <p className="text-xs text-slate-400 font-mono">{confirmDelete.ticket_number}</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-300 mb-6">
                            Tem certeza que deseja excluir este chamado? O registro será preservado no banco de dados, mas não ficará mais visível.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmDelete(null)}
                                disabled={deleting}
                                className="flex-1 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 text-sm transition-all disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de criação */}
            {showModal && (
                <CriarTicketModal
                    onClose={() => setShowModal(false)}
                    onSuccess={handleTicketCreated}
                />
            )}
        </div>
    );
}
