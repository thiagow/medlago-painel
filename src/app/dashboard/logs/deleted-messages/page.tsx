"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    FileSearch,
    MessageSquareX,
    MessageCircle,
    ChevronLeft,
    ChevronRight,
    SearchX,
    Phone
} from "lucide-react";

interface DeleteLog {
    id: string;
    message_id: string;
    chat_id: string;
    conversation_id: string | null;
    deleted_by: string | null;
    user_name: string;
    original_content: string | null;
    media_type: string | null;
    created_at: string;
}

export default function DeletedMessagesAuditPage() {
    const { user, loading: authLoading, isAdmin } = useAuth();
    const router = useRouter();

    const [logs, setLogs] = useState<DeleteLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Paginação
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 15;

    useEffect(() => {
        if (!authLoading) {
            if (!user || (!isAdmin() && user.role !== "ADMIN")) {
                router.push("/dashboard");
                return;
            }
            fetchLogs(page);
        }
    }, [user, authLoading, router, page]);

    const fetchLogs = async (currentPage: number) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/logs/deleted-messages?page=${currentPage}&limit=${limit}`);
            if (!res.ok) {
                if (res.status === 403) throw new Error("Acesso negado.");
                throw new Error("Falha ao buscar os logs.");
            }
            const data = await res.json();
            if (data.success) {
                setLogs(data.logs);
                setTotalPages(data.pagination.totalPages || 1);
            } else {
                setError(data.error || "Erro desconhecido.");
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || (loading && logs.length === 0 && !error)) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center h-full">
                <span className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (!user || (!isAdmin() && user.role !== "ADMIN")) {
        return null;
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-400 flex items-center justify-center shadow-lg shadow-rose-500/20">
                        <MessageSquareX className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                            Mensagens Apagadas
                        </h1>
                        <p className="text-sm text-slate-400 mt-1">
                            Auditoria de mensagens que foram apagadas do chat pelos atendentes.
                        </p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                    <MessageSquareX className="w-4 h-4" />
                    {error}
                </div>
            )}

            {/* Content Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-800/50 text-slate-400 font-medium border-b border-slate-800">
                            <tr>
                                <th className="px-6 py-4">Data/Hora</th>
                                <th className="px-6 py-4">Usuário</th>
                                <th className="px-6 py-4">Conversa / ID</th>
                                <th className="px-6 py-4 w-1/2">Conteúdo Original</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4 text-slate-300">
                                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-400 border border-slate-700">
                                                {log.user_name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="text-slate-200">{log.user_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-mono text-xs text-slate-400 bg-slate-950 px-2 py-1 rounded inline-block">
                                            Chat ID: {log.chat_id}
                                        </div>
                                        {log.conversation_id && (
                                            <div className="text-xs text-slate-500 mt-1 truncate max-w-[150px]" title={log.conversation_id}>
                                                {log.conversation_id}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-normal">
                                        <div className="max-w-md bg-slate-950/50 rounded-lg p-3 border border-slate-800/50">
                                            {log.media_type && (
                                                <span className="text-xs font-medium text-rose-400 mb-1 block">
                                                    [Mídia: {log.media_type}]
                                                </span>
                                            )}
                                            <p className="text-slate-300 text-sm break-words line-clamp-3 hover:line-clamp-none transition-all">
                                                {log.original_content || <span className="text-slate-600 italic">Sem conteúdo em texto</span>}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {logs.length === 0 && !loading && !error && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center">
                                            <SearchX className="w-10 h-10 text-slate-600 mb-3" />
                                            <p className="text-slate-300 font-medium">Nenhum log encontrado</p>
                                            <p className="text-sm mt-1">Não há registros de mensagens apagadas.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-slate-800 flex items-center justify-between text-sm">
                        <span className="text-slate-400">
                            Página <span className="text-white font-medium">{page}</span> de <span className="text-white font-medium">{totalPages}</span>
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1 || loading}
                                className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages || loading}
                                className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
