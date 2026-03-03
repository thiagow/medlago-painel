"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
    const [showConfirm, setShowConfirm] = useState<"transfer" | "reactivate" | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const fetchChats = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (statusFilter) params.set("status", statusFilter);

            const res = await fetch(`/api/chats?${params.toString()}`);
            if (!res.ok) return;
            const data = await res.json();
            setChats(data.chats || []);
        } catch (err) {
            console.error("Erro ao buscar chats:", err);
        } finally {
            setLoadingChats(false);
        }
    }, [search, statusFilter]);

    const fetchMessages = useCallback(async (chatId: string) => {
        setLoadingMessages(true);
        try {
            const res = await fetch(`/api/chats/${chatId}/messages`);
            if (!res.ok) return;
            const data = await res.json();
            setMessages(data.messages || []);
        } catch (err) {
            console.error("Erro ao buscar mensagens:", err);
        } finally {
            setLoadingMessages(false);
        }
    }, []);

    // Polling a cada 30 segundos
    useEffect(() => {
        fetchChats();
        const interval = setInterval(fetchChats, 30000);
        return () => clearInterval(interval);
    }, [fetchChats]);

    useEffect(() => {
        if (selectedChat) fetchMessages(selectedChat.id);
    }, [selectedChat, fetchMessages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSelectChat = (chat: Chat) => {
        setSelectedChat(chat);
        setMessages([]);
    };

    const handleTransfer = async () => {
        if (!selectedChat) return;
        setTransferring(true);
        setShowConfirm(null);
        try {
            const res = await fetch(`/api/chats/${selectedChat.id}/transfer`, { method: "POST" });
            if (!res.ok) throw new Error();
            toast.success("Conversa transferida para humano!");
            setSelectedChat((prev) => prev ? { ...prev, ai_service: "paused" } : null);
            setChats((prev) => prev.map((c) => c.id === selectedChat.id ? { ...c, ai_service: "paused" } : c));
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
            fetchMessages(selectedChat.id);
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
            setSelectedChat((prev) => prev ? { ...prev, ai_service: "paused" } : null);
            setChats((prev) => prev.map((c) => c.id === selectedChat.id ? { ...c, ai_service: "paused" } : c));
            toast.success("Mensagem enviada!");
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
        return phone.replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, "+$1 ($2) $3-$4");
    };

    return (
        <div className="flex h-full overflow-hidden">
            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <h3 className="text-white font-semibold text-lg mb-2">
                            {showConfirm === "transfer" ? "Transferir para Humano?" : "Reativar IA?"}
                        </h3>
                        <p className="text-slate-400 text-sm mb-6">
                            {showConfirm === "transfer"
                                ? "O paciente será notificado e a IA será pausada por 24 horas."
                                : "A IA será reativada e o paciente será informado."}
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 transition-all text-sm">
                                Cancelar
                            </button>
                            <button
                                onClick={showConfirm === "transfer" ? handleTransfer : handleReactivate}
                                className={`flex-1 py-2.5 rounded-xl text-white font-medium transition-all text-sm ${showConfirm === "transfer"
                                        ? "bg-amber-600 hover:bg-amber-500"
                                        : "bg-green-600 hover:bg-green-500"
                                    }`}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Painel Esquerdo - Lista de Conversas */}
            <div className="w-80 md:w-96 border-r border-slate-800 flex flex-col bg-slate-900 shrink-0">
                {/* Header */}
                <div className="p-4 border-b border-slate-800">
                    <h1 className="text-white font-semibold text-lg mb-3">Conversas</h1>
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            id="search-chats"
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por telefone..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                    </div>
                    <div className="flex gap-2">
                        {[
                            { value: "", label: "Todos" },
                            { value: "active", label: "🟢 Ativo" },
                            { value: "paused", label: "🔴 Pausado" },
                        ].map(({ value, label }) => (
                            <button
                                key={value}
                                id={`filter-${value || "all"}`}
                                onClick={() => setStatusFilter(value)}
                                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${statusFilter === value
                                        ? "bg-blue-600 text-white"
                                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Lista */}
                <div className="flex-1 overflow-y-auto">
                    {loadingChats ? (
                        <div className="flex items-center justify-center h-32">
                            <span className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                        </div>
                    ) : chats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-slate-500 gap-2">
                            <MessageSquare className="w-8 h-8" />
                            <span className="text-sm">Nenhuma conversa encontrada</span>
                        </div>
                    ) : (
                        chats.map((chat) => (
                            <button
                                key={chat.id}
                                id={`chat-item-${chat.id}`}
                                onClick={() => handleSelectChat(chat)}
                                className={`w-full p-4 border-b border-slate-800/80 text-left transition-all hover:bg-slate-800/60 ${selectedChat?.id === chat.id ? "bg-blue-600/10 border-l-2 border-l-blue-500" : ""
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                                            <Phone className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-white truncate">{formatPhone(chat.phone)}</p>
                                            <p className="text-xs text-slate-500 truncate">{chat.email || "—"}</p>
                                        </div>
                                    </div>
                                    <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${chat.ai_service === "active"
                                            ? "bg-emerald-500/15 text-emerald-400"
                                            : "bg-red-500/15 text-red-400"
                                        }`}>
                                        {chat.ai_service === "active" ? "🟢 Ativo" : "🔴 Pausado"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 mt-2 text-xs text-slate-600">
                                    <Clock className="w-3 h-3" />
                                    <span>{formatDate(chat.updated_at)}</span>
                                </div>
                            </button>
                        ))
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
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${selectedChat.ai_service === "active"
                                            ? "bg-emerald-500/15 text-emerald-400"
                                            : "bg-red-500/15 text-red-400"
                                        }`}>
                                        {selectedChat.ai_service === "active" ? "🟢 IA Ativa" : "🔴 IA Pausada"}
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
                                {selectedChat.ai_service === "paused" ? (
                                    <button
                                        id="btn-reactivate-ai"
                                        onClick={() => setShowConfirm("reactivate")}
                                        disabled={reactivating}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-60"
                                    >
                                        <Bot className="w-4 h-4" />
                                        <span className="hidden sm:block">Reativar IA</span>
                                    </button>
                                ) : (
                                    <button
                                        id="btn-transfer-human"
                                        onClick={() => setShowConfirm("transfer")}
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
                            {loadingMessages ? (
                                <div className="flex justify-center py-8">
                                    <span className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
                                    <MessageSquare className="w-10 h-10 opacity-30" />
                                    <span className="text-sm">Nenhuma mensagem ainda</span>
                                </div>
                            ) : (
                                messages.map((msg) => {
                                    const isUser = !!msg.user_message;
                                    const text = isUser ? msg.user_message : msg.bot_message;
                                    const isInactive = msg.active === false;

                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                                        >
                                            <div
                                                className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm transition-opacity ${isUser
                                                        ? `bg-blue-600 text-white rounded-br-sm ${isInactive ? "opacity-40" : ""}`
                                                        : `bg-slate-800 text-slate-100 rounded-bl-sm ${isInactive ? "opacity-40" : ""}`
                                                    }`}
                                            >
                                                <p className="leading-relaxed whitespace-pre-wrap break-words">{text}</p>
                                                <div className={`flex items-center gap-1.5 mt-1 ${isUser ? "justify-end" : "justify-start"}`}>
                                                    <span className={`text-[10px] ${isUser ? "text-blue-200/70" : "text-slate-500"}`}>
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
