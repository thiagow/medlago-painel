"use client";
import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { 
    TrendingUp, 
    Search, 
    CalendarDays, 
    RefreshCw, 
    MessageCircle,
    Bot,
    User,
    ListFilter,
    X
} from "lucide-react";

interface AiTransfer {
    id: string;
    chat_id: string;
    created_at: string;
    user_name: string;
    reason: string;
    summary: string;
    transfer_type: string | null;
    department_name: string;
}

interface TopReason {
    reason: string;
    count: number;
    pct: number;
}

interface AnalysisData {
    transfers: AiTransfer[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    stats: {
        total_period: number;
        top_reasons: TopReason[];
    };
}

interface ChatMessage {
    id: string;
    created_at: string | null;
    bot_message: string | null;
    user_message: string | null;
}

export default function AiTransfersAnalysisPage() {
    const { user, isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();

    const [data, setData] = useState<AnalysisData | null>(null);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [search, setSearch] = useState("");
    
    // Paginação
    const [page, setPage] = useState(1);
    
    // Modal de Histórico
    const [selectedTransfer, setSelectedTransfer] = useState<AiTransfer | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);

    useEffect(() => {
        if (!authLoading && user && !isAdmin()) {
            router.push("/dashboard");
        }
    }, [user, isAdmin, authLoading, router]);

    const fetchData = useCallback(async () => {
        if (!isAdmin()) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: page.toString(), limit: "50" });
            if (startDate) params.set("startDate", startDate);
            if (endDate) params.set("endDate", endDate);
            if (search) params.set("search", search);

            const res = await fetch(`/api/analysis/ai-transfers?${params.toString()}`);
            if (!res.ok) return;
            const result = await res.json();
            setData(result);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, search, page, isAdmin]);

    useEffect(() => { 
        fetchData(); 
    }, [fetchData]);

    const viewHistory = async (transfer: AiTransfer) => {
        setSelectedTransfer(transfer);
        setLoadingMessages(true);
        setMessages([]);
        try {
            const res = await fetch(`/api/analysis/ai-transfers/${transfer.id}/messages`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages || []);
            }
        } finally {
            setLoadingMessages(false);
        }
    };

    if (authLoading || (!isAdmin() && user)) {
        return <div className="p-8 text-center text-slate-400">Verificando permissões...</div>;
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
            
            {/* CABEÇALHO E FILTROS */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <TrendingUp className="w-6 h-6 text-indigo-400" />
                            Análise de Transferências da IA
                        </h1>
                        <p className="text-slate-400 mt-1">
                            Acompanhe e analise os motivos pelos quais a inteligência artificial está redirecionando chats para a equipe humana.
                        </p>
                    </div>

                    <button
                        onClick={fetchData}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                        disabled={loading}
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Busca */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar por motivo ou resumo..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchData()}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                    </div>

                    <div className="relative">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                        <CalendarDays className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                    </div>

                    <div className="relative">
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                        <CalendarDays className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                    </div>
                </div>
            </div>

            {loading && !data ? (
                <div className="text-center py-12 text-slate-400">Carregando análise...</div>
            ) : data && (
                <>
                    {/* CARDS INDICADORES */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <div className="text-sm font-medium text-slate-400 mb-1">Total de Transferências (IA)</div>
                            <div className="text-4xl font-bold text-white">{data.stats.total_period}</div>
                        </div>
                        
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:col-span-2">
                            <div className="text-sm font-medium text-slate-400 mb-4 flex items-center gap-2">
                                <ListFilter className="w-4 h-4" /> Top 3 Motivos de Transferência
                            </div>
                            <div className="space-y-4">
                                {data.stats.top_reasons.slice(0, 3).map((tr, idx) => (
                                    <div key={idx} className="relative pt-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm font-medium text-slate-200 truncate pr-4">{tr.reason}</span>
                                            <span className="text-xs text-slate-400 whitespace-nowrap">{tr.count} ocorrências ({tr.pct}%)</span>
                                        </div>
                                        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-slate-800">
                                            <div style={{ width: `${tr.pct}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500"></div>
                                        </div>
                                    </div>
                                ))}
                                {data.stats.top_reasons.length === 0 && (
                                    <div className="text-sm text-slate-500">Nenhum motivo registrado.</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* TABELA DE REGISTROS */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-800">
                            <h2 className="text-lg font-bold text-white">Detalhamento das Transferências</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-300">
                                <thead className="bg-slate-800/50 text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">Data</th>
                                        <th className="px-6 py-4 font-medium">Motivo (enviado pelo N8N)</th>
                                        <th className="px-6 py-4 font-medium">Fila Destino</th>
                                        <th className="px-6 py-4 font-medium text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {data.transfers.map((t) => (
                                        <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {format(new Date(t.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                            </td>
                                            <td className="px-6 py-4 max-w-md">
                                                <div className="font-medium text-slate-200 truncate" title={t.reason}>{t.reason}</div>
                                                <div className="text-xs text-slate-500 truncate mt-1" title={t.summary}>{t.summary}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-full text-xs border border-slate-700">
                                                    {t.department_name}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => viewHistory(t)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg transition-colors"
                                                >
                                                    <MessageCircle className="w-3.5 h-3.5" />
                                                    Ver Conversa
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {data.transfers.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                                Nenhuma transferência da IA encontrada nesse período.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        
                        {/* Paginação Básica */}
                        {data.totalPages > 1 && (
                            <div className="px-6 py-4 border-t border-slate-800 flex justify-between items-center text-sm">
                                <span className="text-slate-400">Página {data.page} de {data.totalPages}</span>
                                <div className="flex gap-2">
                                    <button 
                                        disabled={page === 1} 
                                        onClick={() => setPage(p => p - 1)}
                                        className="px-3 py-1 bg-slate-800 rounded disabled:opacity-50 text-slate-300"
                                    >
                                        Anterior
                                    </button>
                                    <button 
                                        disabled={page === data.totalPages} 
                                        onClick={() => setPage(p => p + 1)}
                                        className="px-3 py-1 bg-slate-800 rounded disabled:opacity-50 text-slate-300"
                                    >
                                        Próxima
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* MODAL / DRAWER DE HISTÓRICO */}
            {selectedTransfer && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-2xl bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-800 animate-in slide-in-from-right duration-300">
                        {/* Header do Drawer */}
                        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-start bg-slate-950">
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    Histórico de Atendimento
                                    <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-xs rounded border border-indigo-500/30">
                                        Chat #{selectedTransfer.chat_id}
                                    </span>
                                </h3>
                                <p className="text-sm text-slate-400 mt-1">
                                    {format(new Date(selectedTransfer.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                </p>
                            </div>
                            <button 
                                onClick={() => setSelectedTransfer(null)}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Resumo da Transferência */}
                        <div className="p-6 bg-slate-900 border-b border-slate-800">
                            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Motivo reportado pela IA</div>
                            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-200 p-3 rounded-lg text-sm mb-4">
                                {selectedTransfer.reason}
                            </div>
                            
                            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Resumo da IA</div>
                            <div className="bg-slate-800/50 border border-slate-700 text-slate-300 p-3 rounded-lg text-sm">
                                {selectedTransfer.summary || "Nenhum resumo disponível."}
                            </div>
                        </div>

                        {/* Corpo com as Mensagens */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950">
                            {loadingMessages ? (
                                <div className="text-center py-10 text-slate-500">Buscando mensagens...</div>
                            ) : messages.length === 0 ? (
                                <div className="text-center py-10 text-slate-500">Nenhuma mensagem encontrada neste chat.</div>
                            ) : (
                                messages.map((msg, idx) => (
                                    <div key={msg.id} className={`flex flex-col ${msg.user_message ? 'items-end' : 'items-start'}`}>
                                        <div className={`flex items-end gap-2 max-w-[85%] ${msg.user_message ? 'flex-row-reverse' : ''}`}>
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-slate-800 border border-slate-700 text-slate-300">
                                                {msg.user_message ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-emerald-400" />}
                                            </div>
                                            
                                            <div className={`p-4 rounded-2xl text-sm shadow-sm ${
                                                msg.user_message 
                                                    ? 'bg-indigo-600 text-white rounded-tr-sm' 
                                                    : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-sm'
                                            }`}>
                                                <div className="whitespace-pre-wrap">{msg.user_message || msg.bot_message}</div>
                                                <div className={`text-[10px] mt-2 opacity-70 ${msg.user_message ? 'text-indigo-200 text-right' : 'text-slate-400'}`}>
                                                    {msg.created_at ? format(new Date(msg.created_at), "HH:mm") : ''}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
