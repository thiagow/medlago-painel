"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
    LifeBuoy,
    ArrowLeft,
    Bug,
    Wrench,
    Lightbulb,
    HelpCircle,
    Ticket,
    AlertCircle,
    ExternalLink,
    Image as ImageIcon,
    Loader2,
    Send,
    CheckCircle2,
    XCircle,
    Clock,
    RefreshCw,
    User,
    Shield,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Anexo {
    id: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    proxy_url: string;
    created_at: string;
}

interface Resposta {
    id: string;
    mensagem: string;
    is_admin: boolean;
    created_by: string;
    author_name: string;
    created_at: string;
}

interface Ticket {
    id: string;
    ticket_number: string;
    titulo: string;
    descricao: string;
    tipo: string;
    prioridade: string;
    status: string;
    video_url: string | null;
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
    created_by: string;
    creator_name: string;
    resolved_by: string | null;
    resolver_name: string | null;
    anexos: Anexo[];
    respostas: Resposta[];
}

// ─── Badge helpers ─────────────────────────────────────────────────────────────

function statusInfo(status: string) {
    const map: Record<string, { cls: string; label: string; icon: React.ElementType }> = {
        aberto:       { cls: "bg-blue-500/15 text-blue-300 border-blue-500/30",      label: "Aberto",       icon: Ticket },
        em_andamento: { cls: "bg-amber-500/15 text-amber-300 border-amber-500/30",    label: "Em andamento", icon: Clock },
        finalizado:   { cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", label: "Finalizado", icon: CheckCircle2 },
        cancelado:    { cls: "bg-slate-500/15 text-slate-400 border-slate-500/30",   label: "Cancelado",    icon: XCircle },
    };
    return map[status] ?? { cls: "bg-slate-500/15 text-slate-400", label: status, icon: Ticket };
}

function prioridadeInfo(p: string) {
    const map: Record<string, { cls: string; label: string }> = {
        baixa:   { cls: "bg-slate-500/15 text-slate-400 border-slate-500/30",    label: "Baixa" },
        media:   { cls: "bg-blue-500/15 text-blue-300 border-blue-500/30",        label: "Média" },
        alta:    { cls: "bg-orange-500/15 text-orange-300 border-orange-500/30",  label: "Alta" },
        critica: { cls: "bg-red-500/15 text-red-300 border-red-500/30",           label: "Crítica" },
    };
    return map[p] ?? { cls: "bg-slate-500/15 text-slate-400", label: p };
}

function tipoInfo(tipo: string) {
    const map: Record<string, { icon: React.ElementType; label: string; color: string }> = {
        bug:      { icon: Bug,          label: "Bug",      color: "text-red-400" },
        erro:     { icon: AlertCircle,  label: "Erro",     color: "text-orange-400" },
        melhoria: { icon: Lightbulb,    label: "Melhoria", color: "text-blue-400" },
        duvida:   { icon: HelpCircle,   label: "Dúvida",   color: "text-violet-400" },
    };
    return map[tipo] ?? { icon: Ticket, label: tipo, color: "text-slate-400" };
}

// ─── Página de Detalhe ─────────────────────────────────────────────────────────

export default function SuporteDetalhe({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router  = useRouter();
    const { isAdmin } = useAuth();
    const admin = isAdmin();

    const [ticket, setTicket]           = useState<Ticket | null>(null);
    const [loading, setLoading]         = useState(true);
    const [error, setError]             = useState("");
    const [novoStatus, setNovoStatus]   = useState("");
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [mensagem, setMensagem]       = useState("");
    const [sending, setSending]         = useState(false);
    const [sendError, setSendError]     = useState("");
    const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

    const fetchTicket = useCallback(async () => {
        try {
            const res = await fetch(`/api/suporte/${id}`, { cache: "no-store" });
            if (!res.ok) {
                const json = await res.json();
                setError(json.error ?? "Erro ao carregar chamado");
                return;
            }
            const json = await res.json();
            setTicket(json.data);
            setNovoStatus(json.data.status);
        } catch {
            setError("Erro de conexão");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchTicket(); }, [fetchTicket]);

    const handleStatusUpdate = async () => {
        if (!novoStatus || novoStatus === ticket?.status) return;
        setUpdatingStatus(true);
        try {
            const res = await fetch(`/api/suporte/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: novoStatus }),
            });
            const json = await res.json();
            if (!res.ok) { alert(json.error ?? "Erro ao atualizar status"); return; }
            setTicket(t => t ? { ...t, status: json.data.status, resolved_at: json.data.resolved_at } : t);
        } catch {
            alert("Erro de conexão");
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleEnviarResposta = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mensagem.trim()) return;
        setSendError("");
        setSending(true);
        try {
            const res = await fetch(`/api/suporte/${id}/resposta`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mensagem: mensagem.trim() }),
            });
            const json = await res.json();
            if (!res.ok) { setSendError(json.error ?? "Erro ao enviar resposta"); return; }
            setMensagem("");
            // Atualiza a thread + status inline (pode ter mudado para em_andamento)
            setTicket(t => {
                if (!t) return t;
                return {
                    ...t,
                    status: t.status === "aberto" ? "em_andamento" : t.status,
                    respostas: [...t.respostas, json.data],
                };
            });
            setNovoStatus(prev => prev === "aberto" ? "em_andamento" : prev);
        } catch {
            setSendError("Erro de conexão");
        } finally {
            setSending(false);
        }
    };

    // ── Render ──────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-slate-600 animate-spin" />
            </div>
        );
    }

    if (error || !ticket) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <AlertCircle className="w-12 h-12 text-red-500/60 mb-3" />
                <p className="text-slate-300 font-medium">{error || "Chamado não encontrado"}</p>
                <button onClick={() => router.push("/dashboard/suporte")} className="mt-4 text-sm text-blue-400 hover:text-blue-300">
                    ← Voltar para Suporte
                </button>
            </div>
        );
    }

    const si = statusInfo(ticket.status);
    const pi = prioridadeInfo(ticket.prioridade);
    const ti = tipoInfo(ticket.tipo);
    const TipoIcon = ti.icon;
    const StatusIcon = si.icon;

    return (
        <div className="p-6 md:p-8 max-w-5xl mx-auto w-full overflow-y-auto h-full">

            {/* Voltar */}
            <button
                onClick={() => router.push("/dashboard/suporte")}
                className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" /> Voltar para Suporte
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* ── Coluna principal ─────────────────────────────────────── */}
                <div className="lg:col-span-2 space-y-5">

                    {/* Cabeçalho do ticket */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-lg font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-xl border border-blue-500/20">
                                    {ticket.ticket_number}
                                </span>
                                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${si.cls}`}>
                                    <StatusIcon className="w-3.5 h-3.5" />
                                    {si.label}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 text-xs">
                                    <TipoIcon className={`w-3.5 h-3.5 ${ti.color}`} />
                                    <span className="text-slate-400">{ti.label}</span>
                                </div>
                                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${pi.cls}`}>{pi.label}</span>
                            </div>
                        </div>

                        <h1 className="text-xl font-bold text-white mb-3">{ticket.titulo}</h1>
                        <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{ticket.descricao}</p>

                        {ticket.video_url && (
                            <a
                                href={ticket.video_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-4 inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Ver vídeo anexado
                            </a>
                        )}
                    </div>

                    {/* Anexos */}
                    {ticket.anexos.length > 0 && (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="p-1.5 rounded-lg bg-slate-700">
                                    <ImageIcon className="w-4 h-4 text-slate-300" />
                                </div>
                                <h3 className="text-sm font-semibold text-white">
                                    Imagens ({ticket.anexos.length})
                                </h3>
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                {ticket.anexos.map(a => (
                                    <button
                                        key={a.id}
                                        onClick={() => setLightboxSrc(a.proxy_url)}
                                        className="relative group rounded-xl overflow-hidden border border-slate-700 hover:border-slate-600 transition-colors aspect-square"
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={a.proxy_url}
                                            alt={a.file_name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                        />
                                        <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/30 transition-colors flex items-center justify-center">
                                            <ExternalLink className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Thread de respostas */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-5">
                            <LifeBuoy className="w-4 h-4 text-slate-400" />
                            <h3 className="text-sm font-semibold text-white">
                                Histórico {ticket.respostas.length > 0 && `(${ticket.respostas.length})`}
                            </h3>
                        </div>

                        {ticket.respostas.length === 0 ? (
                            <div className="text-center py-8">
                                <LifeBuoy className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                                <p className="text-xs text-slate-500">Nenhuma resposta ainda</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {ticket.respostas.map(r => (
                                    <div
                                        key={r.id}
                                        className={`flex gap-3 ${r.is_admin ? "flex-row-reverse" : "flex-row"}`}
                                    >
                                        {/* Avatar */}
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                            r.is_admin ? "bg-blue-600" : "bg-slate-700"
                                        }`}>
                                            {r.is_admin
                                                ? <Shield className="w-4 h-4 text-white" />
                                                : <User className="w-4 h-4 text-slate-300" />
                                            }
                                        </div>
                                        {/* Balão */}
                                        <div className={`max-w-[80%] ${r.is_admin ? "items-end" : "items-start"} flex flex-col gap-1`}>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500">
                                                    {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                                </span>
                                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                                    r.is_admin
                                                        ? "bg-blue-500/20 text-blue-300"
                                                        : "bg-slate-700 text-slate-400"
                                                }`}>
                                                    {r.is_admin ? "Suporte" : r.author_name}
                                                </span>
                                            </div>
                                            <div className={`px-4 py-3 rounded-2xl text-sm text-slate-200 leading-relaxed whitespace-pre-wrap ${
                                                r.is_admin
                                                    ? "bg-blue-600/20 border border-blue-500/20 rounded-tr-sm"
                                                    : "bg-slate-800 border border-slate-700 rounded-tl-sm"
                                            }`}>
                                                {r.mensagem}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Sidebar ──────────────────────────────────────────────── */}
                <div className="space-y-4">

                    {/* Informações */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Informações</h3>
                        <div className="space-y-3 text-sm">
                            <div>
                                <p className="text-slate-500 text-xs mb-0.5">Criado por</p>
                                <p className="text-slate-200 font-medium">{ticket.creator_name}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 text-xs mb-0.5">Data de abertura</p>
                                <p className="text-slate-200">
                                    {format(new Date(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                            </div>
                            {ticket.resolved_at && (
                                <div>
                                    <p className="text-slate-500 text-xs mb-0.5">
                                        {ticket.status === "finalizado" ? "Finalizado em" : "Atualizado em"}
                                    </p>
                                    <p className="text-slate-200">
                                        {format(new Date(ticket.resolved_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                    </p>
                                    {ticket.resolver_name && (
                                        <p className="text-xs text-slate-500 mt-0.5">por {ticket.resolver_name}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Ações admin */}
                    {admin && (
                        <>
                            {/* Alterar Status */}
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Alterar Status</h3>
                                <select
                                    value={novoStatus}
                                    onChange={e => setNovoStatus(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500 transition-colors mb-3"
                                >
                                    <option value="aberto">Aberto</option>
                                    <option value="em_andamento">Em andamento</option>
                                    <option value="finalizado">Finalizado</option>
                                    <option value="cancelado">Cancelado</option>
                                </select>
                                <button
                                    onClick={handleStatusUpdate}
                                    disabled={updatingStatus || novoStatus === ticket.status}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors disabled:opacity-40"
                                >
                                    {updatingStatus
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <RefreshCw className="w-4 h-4" />
                                    }
                                    {updatingStatus ? "Atualizando…" : "Atualizar Status"}
                                </button>
                            </div>

                            {/* Responder */}
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Responder</h3>
                                <form onSubmit={handleEnviarResposta}>
                                    {sendError && (
                                        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-3">
                                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                            {sendError}
                                        </div>
                                    )}
                                    <textarea
                                        value={mensagem}
                                        onChange={e => setMensagem(e.target.value)}
                                        placeholder="Digite sua resposta para o usuário..."
                                        rows={4}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-none mb-3"
                                    />
                                    <button
                                        type="submit"
                                        disabled={sending || !mensagem.trim()}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-40"
                                    >
                                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        {sending ? "Enviando…" : "Enviar Resposta"}
                                    </button>
                                </form>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Lightbox */}
            {lightboxSrc && (
                <div
                    className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4 cursor-zoom-out"
                    onClick={() => setLightboxSrc(null)}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={lightboxSrc}
                        alt="Visualização"
                        className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
