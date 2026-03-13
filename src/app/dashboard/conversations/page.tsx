"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Search,
    Phone,
    Clock,
    Send,
    UserCheck,
    Bot,
    AlertCircle,
    MessageSquare,
    RefreshCw,
    Filter,
    CheckCircle,
} from "lucide-react";
import toast from "react-hot-toast";

interface Chat {
    id: string;
    phone: string | null;
    email: string | null;
    ai_service: string | null;
    conversation_id: string | null;
    created_at: string | null;
    updated_at: string | null;
    last_message_at: string | null;
}

interface Message {
    id: string;
    phone: string | null;
    conversation_id: string | null;
    bot_message: string | null;
    user_message: string | null;
    active: boolean | null;
    created_at: string | null;
}

export default function ConversationsPage() {
    return (
        <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-400">Carregando painel de conversas...</div>}>
            <ConversationsContent />
        </Suspense>
    );
}

function ConversationsContent() {
    const searchParams = useSearchParams();
    const chatIdQuery = searchParams.get("chatId");

    const [chats, setChats] = useState<Chat[]>([]);
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [messageInput, setMessageInput] = useState("");
    const [loadingChats, setLoadingChats] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sendingMessage, setSendingMessage] = useState(false);
    const [transferring, setTransferring] = useState(false);
    const [reactivating, setReactivating] = useState(false);
    const [finishing, setFinishing] = useState(false);
    const [showConfirm, setShowConfirm] = useState<"transfer" | "reactivate" | "finish" | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [transferReason, setTransferReason] = useState("");
    const [transferSummary, setTransferSummary] = useState("");

    const fetchChats = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (statusFilter) params.set("status", statusFilter);

            const res = await fetch(`/api/chats?${params.toString()}&_t=${Date.now()}`, { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json();
            setChats(data.chats || []);
        } catch (err) {
            console.error("Erro ao buscar chats:", err);
        } finally {
            setLoadingChats(false);
        }
    }, [search, statusFilter]);

    const fetchMessages = useCallback(async (chatId: string, background = false) => {
        if (!background) setLoadingMessages(true);
        try {
            const res = await fetch(`/api/chats/${chatId}/messages?_t=${Date.now()}`, { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json();

            // Autoscroll se temos novas mensagens em relacao ao que ja tinhamos
            setMessages((prev) => {
                if (prev.length < (data.messages || []).length && background) {
                    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                }
                return data.messages || [];
            });
        } catch (err) {
            console.error("Erro ao buscar mensagens:", err);
        } finally {
            if (!background) setLoadingMessages(false);
        }
    }, []);

    // Polling a cada 5 segundos para o chat selecionado (Soft Polling do histórico quase tempo real)
    useEffect(() => {
        if (!selectedChat) return;

        // Fetch inicial com loading screen
        fetchMessages(selectedChat.id, false);

        const interval = setInterval(() => {
            fetchMessages(selectedChat.id, true);
        }, 5000);

        return () => clearInterval(interval);
    }, [selectedChat?.id, fetchMessages]);

    // Polling a cada 30 segundos para lista lateral
    useEffect(() => {
        fetchChats();
        const interval = setInterval(fetchChats, 30000);
        return () => clearInterval(interval);
    }, [fetchChats]);

    // Resgate individual de chat passado via Parâmetro /dashboard/conversations?chatId=X
    useEffect(() => {
        if (!chatIdQuery) return;
        if (selectedChat?.id === chatIdQuery) return;

        setChats(prev => {
            const existing = prev.find(c => c.id === chatIdQuery);
            if (existing) {
                if (selectedChat?.id !== existing.id) setSelectedChat(existing);
                return prev;
            }

            // Requisita o chat do banco já que ele não consta nos últimos limit=10 recentes
            fetch(`/api/chats/${chatIdQuery}?_t=${Date.now()}`, { cache: "no-store" })
                .then(res => res.json())
                .then(data => {
                    if (data.chat) {
                        setChats(curr => {
                            if (curr.find(c => c.id === data.chat.id)) return curr;
                            return [data.chat, ...curr];
                        });
                        setSelectedChat(data.chat);
                    }
                }).catch(err => console.error("Erro ao carregar chat específico:", err));
            return prev;
        });
    }, [chatIdQuery, selectedChat?.id]);

    useEffect(() => {
        if (messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [selectedChat?.id]); // Rola suave quando troca de chat e carrega pela primeira vez

    const handleSelectChat = (chat: Chat) => {
        if (selectedChat?.id === chat.id) return;
        setSelectedChat(chat);
        setMessages([]);
    };

    const handleTransfer = async () => {
        if (!selectedChat) return;
        if (!transferReason.trim() || !transferSummary.trim()) {
            toast.error("Preencha o motivo e resumo");
            return;
        }

        setTransferring(true);
        try {
            const res = await fetch(`/api/chats/${selectedChat.id}/transfer`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    reason: transferReason.trim(),
                    summary: transferSummary.trim()
                })
            });
            if (!res.ok) throw new Error();

            toast.success("Conversa transferida para equipe!");
            setShowConfirm(null);
            setTransferReason("");
            setTransferSummary("");

            // Remover chat da lista (transferidos não aparecem mais)
            setChats((prev) => prev.filter((c) => c.id !== selectedChat.id));
            setSelectedChat(null);
            setMessages([]);
        } catch {
            toast.error("Erro ao transferir conversa");
        } finally {
            setTransferring(false);
        }
    };

    const handleReactivate = async () => {
        if (!selectedChat) return;
        setReactivating(true);
        setShowConfirm(null);
        try {
            const res = await fetch(`/api/chats/${selectedChat.id}/reactivate`, { method: "POST" });
            if (!res.ok) throw new Error();
            toast.success("IA reativada com sucesso!");
            setSelectedChat((prev) => prev ? { ...prev, ai_service: "active" } : null);
            setChats((prev) => prev.map((c) => c.id === selectedChat.id ? { ...c, ai_service: "active" } : c));
            fetchMessages(selectedChat.id, true);
        } catch {
            toast.error("Erro ao reativar IA");
        } finally {
            setReactivating(false);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedChat || !messageInput.trim()) return;
        setSendingMessage(true);
        try {
            const res = await fetch(`/api/chats/${selectedChat.id}/send-message`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: messageInput.trim() }),
            });
            if (!res.ok) throw new Error();
            const data = await res.json();

            setMessages((prev) => [...prev, data.message]);
            setMessageInput("");

            // Pausar UI (o backend já pausou a IA localmente sem transferir à equipe)
            setSelectedChat((prev) => prev ? { ...prev, ai_service: "paused" } : null);
            setChats((prev) => prev.map((c) => c.id === selectedChat.id ? { ...c, ai_service: "paused" } : c));

            // Rola pro fim
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        } catch {
            toast.error("Erro ao enviar mensagem");
        } finally {
            setSendingMessage(false);
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "—";
        try {
            return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
        } catch {
            return "—";
        }
    };

    const formatPhone = (phone: string | null) => {
        if (!phone) return "Desconhecido";
        const cleanPhone = phone.split('@')[0];
        return cleanPhone.replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, "+$1 ($2) $3-$4");
    };

    const isAiActive = (service: string | null | undefined) => {
        if (!service) return false;
        const s = String(service).toLowerCase();
        return s === "active" || s === "true";
    };

    const getStatusInfo = (service: string | null | undefined) => {
        const s = String(service || "").toLowerCase();
        if (s === "active" || s === "true") return { label: "IA Ativa", emoji: "🟢", color: "bg-emerald-500", badgeClass: "bg-emerald-500/15 text-emerald-400" };
        if (s === "paused") return { label: "Atendimento Humano", emoji: "🟠", color: "bg-amber-500", badgeClass: "bg-amber-500/15 text-amber-400" };
        return { label: "Desconhecido", emoji: "⚪", color: "bg-slate-500", badgeClass: "bg-slate-500/15 text-slate-400" };
    };

    const handleFinish = async () => {
        if (!selectedChat) return;
        setFinishing(true);
        setShowConfirm(null);
        try {
            const res = await fetch(`/api/chats/${selectedChat.id}/finish`, { method: "POST" });
            if (!res.ok) throw new Error();
            toast.success("Atendimento finalizado com sucesso!");

            // Remover chat da lista (finalizados não aparecem mais)
            setChats((prev) => prev.filter((c) => c.id !== selectedChat.id));
            setSelectedChat(null);
            setMessages([]);
        } catch {
            toast.error("Erro ao finalizar atendimento");
        } finally {
            setFinishing(false);
        }
    };

    const openTransferModal = () => {
        setTransferReason("");
        setTransferSummary("");
        setShowConfirm("transfer");
    };

    return (
        <div className="flex h-full overflow-hidden">
            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <h3 className="text-white font-semibold text-lg mb-2">
                            {showConfirm === "transfer" ? "Transferir para Equipe?" : showConfirm === "finish" ? "Finalizar Atendimento?" : "Reativar IA?"}
                        </h3>

                        {showConfirm === "transfer" ? (
                            <div className="space-y-4 mb-6 mt-4">
                                <div>
                                    <label className="text-xs font-medium text-slate-400 mb-1 block">Motivo da Transferência</label>
                                    <input
                                        type="text"
                                        value={transferReason}
                                        onChange={e => setTransferReason(e.target.value)}
                                        placeholder="Ex: Dúvida não coberta pela IA"
                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-400 mb-1 block">Resumo do Atendimento</label>
                                    <textarea
                                        value={transferSummary}
                                        onChange={e => setTransferSummary(e.target.value)}
                                        placeholder="Breve resumo para o humano que vai assumir..."
                                        rows={3}
                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white resize-none focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                </div>
                            </div>
                        ) : showConfirm === "finish" ? (
                            <p className="text-slate-400 text-sm mb-6 mt-2">
                                O atendimento será finalizado e a conversa será movida para o histórico.
                            </p>
                        ) : (
                            <p className="text-slate-400 text-sm mb-6 mt-2">
                                A IA será reativada e o paciente será informado.
                            </p>
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => setShowConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 transition-all text-sm">
                                Cancelar
                            </button>
                            <button
                                onClick={showConfirm === "transfer" ? handleTransfer : showConfirm === "finish" ? handleFinish : handleReactivate}
                                disabled={(showConfirm === "transfer" && (!transferReason.trim() || !transferSummary.trim())) || transferring || reactivating || finishing}
                                className={`flex-1 py-2.5 rounded-xl text-white font-medium transition-all text-sm disabled:opacity-50 ${showConfirm === "transfer"
                                    ? "bg-amber-600 hover:bg-amber-500"
                                    : showConfirm === "finish"
                                    ? "bg-red-600 hover:bg-red-500"
                                    : "bg-green-600 hover:bg-green-500"
                                    }`}
                            >
                                {showConfirm === "transfer" ? (transferring ? "Enviando..." : "Confirmar") : showConfirm === "finish" ? (finishing ? "Finalizando..." : "Confirmar") : (reactivating ? "Reativando..." : "Confirmar")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Painel Esquerdo - Lista de Conversas */}
            <div className="w-80 border-r border-slate-800 bg-slate-900/50 flex flex-col shrink-0">
                <div className="p-4 border-b border-slate-800">
                    <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-lg font-semibold text-white">Conversas</h2>
                        <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full font-medium">
                            {chats.length}
                        </span>
                    </div>
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Buscar número..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
                        >
                            <option value="all">Todos os status</option>
                            <option value="active">🟢 IA Ativa</option>
                            <option value="paused">🔴 IA Pausada</option>
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loadingChats ? (
                        <div className="flex items-center justify-center h-32">
                            <span className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                        </div>
                    ) : chats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center">
                            <MessageSquare className="w-8 h-8 text-slate-600 mb-3" />
                            <p className="text-sm text-slate-400">Nenhuma conversa encontrada</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-800/50">
                            {chats.map((chat) => (
                                <div
                                    key={chat.id}
                                    onClick={() => handleSelectChat(chat)}
                                    className={`p-4 cursor-pointer transition-all hover:bg-slate-800 ${selectedChat?.id === chat.id
                                        ? "bg-slate-800 border-l-2 border-blue-500"
                                        : "border-l-2 border-transparent"
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-1">
                                        <span className="font-medium text-slate-200 text-sm">{formatPhone(chat.phone)}</span>
                                        <span className="text-[10px] text-slate-500">{formatDate(chat.last_message_at || chat.updated_at)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`w-2 h-2 rounded-full ${getStatusInfo(chat.ai_service).color}`} />
                                        <span className="text-xs text-slate-400">{getStatusInfo(chat.ai_service).label}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {/* Painel Direito - Chat */}
            <div className="flex-1 flex flex-col bg-slate-950 min-w-0">
                {!selectedChat ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-3">
                        <MessageSquare className="w-16 h-16 opacity-30" />
                        <p className="text-lg font-medium">Selecione uma conversa</p>
                        <p className="text-sm">Clique em uma conversa para ver as mensagens</p>
                    </div>
                ) : (
                    <>
                        {/* Chat Header */}
                        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-4 md:px-6 shrink-0 bg-slate-900">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                                    <Phone className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white">{formatPhone(selectedChat.phone)}</p>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusInfo(selectedChat.ai_service).badgeClass}`}>
                                        {getStatusInfo(selectedChat.ai_service).emoji} {getStatusInfo(selectedChat.ai_service).label}
                                    </span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2">
                                <button
                                    id="btn-refresh-messages"
                                    onClick={() => fetchMessages(selectedChat.id)}
                                    title="Atualizar mensagens"
                                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                                {!isAiActive(selectedChat.ai_service) ? (
                                    <>
                                        <button
                                            id="btn-reactivate-ai"
                                            onClick={() => setShowConfirm("reactivate")}
                                            disabled={reactivating}
                                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-60"
                                        >
                                            <Bot className="w-4 h-4" />
                                            <span className="hidden sm:block">Reativar IA</span>
                                        </button>
                                        <button
                                            id="btn-finish-chat"
                                            onClick={() => setShowConfirm("finish")}
                                            disabled={finishing}
                                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-60"
                                        >
                                            <CheckCircle className="w-4 h-4" />
                                            <span className="hidden sm:block">Finalizar</span>
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        id="btn-transfer-human"
                                        onClick={openTransferModal}
                                        disabled={transferring}
                                        className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-60"
                                    >
                                        <UserCheck className="w-4 h-4" />
                                        <span className="hidden sm:block">Transferir para Humano</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-3">
                            {loadingMessages && messages.length === 0 ? (
                                <div className="flex justify-center py-8">
                                    <span className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-8 mt-10 text-slate-600 gap-2">
                                    <MessageSquare className="w-10 h-10 opacity-30" />
                                    <span className="text-sm">Nenhuma mensagem ainda</span>
                                </div>
                            ) : (
                                messages.map((msg) => {
                                    const isInactive = msg.active === false;

                                    return (
                                        <div key={msg.id} className="flex flex-col gap-2">
                                            {/* Mensagem do usuário/lead (vem da tabela e aparece à esquerda como Slate) */}
                                            {msg.user_message && (
                                                <div className="flex justify-start">
                                                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm transition-opacity bg-slate-800 text-slate-100 rounded-bl-sm ${isInactive ? "opacity-40" : ""}`}>
                                                        <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.user_message}</p>
                                                        <div className="flex items-center gap-1.5 mt-1 justify-start">
                                                            <span className="text-[10px] text-slate-500">
                                                                {formatDate(msg.created_at)}
                                                            </span>
                                                            {isInactive && (
                                                                <span className="flex items-center gap-0.5 text-[10px] text-red-400/70">
                                                                    <AlertCircle className="w-2.5 h-2.5" />
                                                                    Inativo
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Mensagem da IA / Atendente (vem da tabela e aparece à direita como Azul) */}
                                            {msg.bot_message && (
                                                <div className="flex justify-end">
                                                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm transition-opacity bg-blue-600 text-white rounded-br-sm ${isInactive ? "opacity-40" : ""}`}>
                                                        <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.bot_message}</p>
                                                        <div className="flex items-center gap-1.5 mt-1 justify-end">
                                                            <span className="text-[10px] text-blue-200/70">
                                                                {formatDate(msg.created_at)}
                                                            </span>
                                                            {isInactive && (
                                                                <span className="flex items-center gap-0.5 text-[10px] text-red-400/70">
                                                                    <AlertCircle className="w-2.5 h-2.5" />
                                                                    Inativo
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Send Message */}
                        <div className="border-t border-slate-800 p-4 bg-slate-900 shrink-0">
                            <form onSubmit={handleSendMessage} className="flex gap-3">
                                <input
                                    id="message-input"
                                    type="text"
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    placeholder="Digite sua mensagem..."
                                    disabled={sendingMessage}
                                    className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-60"
                                />
                                <button
                                    id="btn-send-message"
                                    type="submit"
                                    disabled={sendingMessage || !messageInput.trim()}
                                    className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all disabled:opacity-60 flex items-center gap-2"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </form>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
