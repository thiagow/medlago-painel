"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Bot, UserCheck, Calendar, CheckCircle, ArrowRightLeft } from "lucide-react";

interface Chat {
    id: string;
    phone: string | null;
    email: string | null;
    ai_service: string | null;
    status: string | null;
    created_at: string | null;
    updated_at: string | null;
    finished: boolean | null;
}

export default function HistoryPage() {
    const router = useRouter();
    const [chats, setChats] = useState<Chat[]>([]);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [loading, setLoading] = useState(false);

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: "100" });
            if (search) params.append("search", search);
            if (status) params.append("status", status);
            if (startDate) params.append("startDate", startDate);
            if (endDate) params.append("endDate", endDate);

            const res = await fetch(`/api/chats/history?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setChats(data.chats);
            }
        } catch (error) {
            console.error("Erro ao buscar histórico:", error);
        } finally {
            setLoading(false);
        }
    }, [search, status, startDate, endDate]);

    useEffect(() => {
        // Busca inicial ou sempre que os filtros mudarem (poderia usar um botão Buscar tbm)
        fetchHistory();
    }, [fetchHistory]);

    const formatPhone = (phone: string | null) => {
        if (!phone) return "Desconhecido";
        const cleanPhone = phone.split('@')[0];
        return cleanPhone.replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, "+$1 ($2) $3-$4");
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "—";
        try {
            return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
        } catch {
            return "—";
        }
    };

    const renderStatusBadge = (chat: Chat) => {
        const s = chat.status || (chat.finished ? "finished" : chat.ai_service) || "";

        if (s === "finished") {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Finalizado
                </span>
            );
        }
        if (s === "ai" || s === "active") {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Bot className="w-3.5 h-3.5" />
                    IA Ativa
                </span>
            );
        }
        if (s === "human" || s === "paused") {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <UserCheck className="w-3.5 h-3.5" />
                    Humano
                </span>
            );
        }
        if (s === "waiting") {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Calendar className="w-3.5 h-3.5" />
                    Aguardando
                </span>
            );
        }
        if (s === "transferred_external" || s === "transferred") {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    Transf. Externo
                </span>
            );
        }
        
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                Desconhecido
            </span>
        );
    };
    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-950 p-6 md:p-8 max-w-7xl mx-auto w-full">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white mb-2">Histórico de Atendimentos</h1>
                <p className="text-slate-400">Pesquise por todas as conversas e atendimentos.</p>
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
                <div className="md:col-span-2 relative">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Buscar por número ou nome..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                </div>

                <div className="relative">
                    <Calendar className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all [color-scheme:dark]"
                    />
                </div>
                <div className="relative">
                    <Calendar className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all [color-scheme:dark]"
                    />
                </div>

                <div className="relative">
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white appearance-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all [&>option]:bg-slate-900"
                    >
                        <option value="">Todos</option>
                        <option value="ai">🤖 IA Ativa</option>
                        <option value="waiting">⏳ Em Espera</option>
                        <option value="human">👤 Humano</option>
                        <option value="transferred_external">📞 Transf. Externo</option>
                        <option value="finished">✅ Finalizado</option>
                    </select>
                    {/* SVG Chevron */}
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Listagem */}
            <div className="flex-1 overflow-auto rounded-2xl border border-slate-800 bg-slate-900">
                {loading && chats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64">
                        <span className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4" />
                        <p className="text-slate-400 text-sm">Carregando histórico...</p>
                    </div>
                ) : chats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <Search className="w-8 h-8 text-slate-500" />
                        </div>
                        <p className="text-slate-400 font-medium">Nenhum atendimento encontrado</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-800/50 text-xs uppercase text-slate-500 sticky top-0">
                            <tr>
                                <th className="px-6 py-4 font-medium">Data</th>
                                <th className="px-6 py-4 font-medium">Contato</th>
                                <th className="px-6 py-4 font-medium">Status da IA</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {chats.map((chat) => (
                                <tr
                                    key={chat.id}
                                    className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                                    onClick={() => router.push(`/dashboard/conversations?chatId=${chat.id}`)}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-slate-300">{formatDate(chat.created_at)}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="font-medium text-white">{formatPhone(chat.phone)}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {renderStatusBadge(chat)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
