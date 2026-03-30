"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { formatPhone } from "@/lib/format-phone";
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
    Paperclip,
    FileText,
    Image as ImageIcon,
    FileAudio,
    X,
    Loader2,
    Mic,
    Square,
    ArrowLeft,
    Menu,
    Tag,
    Plus,
    Download,
    User,
    UserPlus,
    History,
    Save,
    ChevronDown,
    Trash2
} from "lucide-react";
import toast from "react-hot-toast";

interface ChatTag {
    id: string;
    name: string;
    color: string;
}

interface Chat {
    id: string;
    phone: string | null;
    email: string | null;
    ai_service: string | null;
    conversation_id: string | null;
    created_at: string | null;
    updated_at: string | null;
    last_message_at: string | null;
    assigned_to: string | null;
    assigned_user_name: string | null;
    department_name: string | null;
    finished: boolean | null;
    status?: string | null;
    tags?: ChatTag[];
    patient_name?: string | null;
}

interface PatientData {
    id?: string;
    nome: string;
    telefone_principal: string;
    cpf?: string;
    email?: string;
    data_nascimento?: string;
}

interface Message {
    id: string;
    phone: string | null;
    conversation_id: string | null;
    bot_message: string | null;
    user_message: string | null;
    active: boolean | null;
    created_at: string | null;
    media_url?: string | null;
    media_type?: string | null;
    media_name?: string | null;
    sender_name?: string | null;
    deleted_at?: string | null;
    deleted_by_name?: string | null;
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
    const router = useRouter();
    const { user } = useAuth();
    const chatIdQuery = searchParams.get("chatId");

    const [chats, setChats] = useState<Chat[]>([]);
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [search, setSearch] = useState("");
    const [tab, setTab] = useState<"ai" | "waiting" | "human">("ai");
    const [messageInput, setMessageInput] = useState("");
    const [loadingChats, setLoadingChats] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    
    // States Paginação Infinite Scroll
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // Gestão de Pacientes
    const [showPatientModal, setShowPatientModal] = useState(false);
    const [linkedPatient, setLinkedPatient] = useState<PatientData | null>(null);
    const [patientForm, setPatientForm] = useState<PatientData>({ nome: "", telefone_principal: "", cpf: "", email: "", data_nascimento: "" });
    const [savingPatient, setSavingPatient] = useState(false);

    // Histórico Consolidado
    const [showHistory, setShowHistory] = useState(false);
    const [historyMessages, setHistoryMessages] = useState<any[]>([]);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyChatsCount, setHistoryChatsCount] = useState(0);

    const [sendingMessage, setSendingMessage] = useState(false);
    const [transferring, setTransferring] = useState(false);
    const [reactivating, setReactivating] = useState(false);
    const [assuming, setAssuming] = useState(false);
    const [finishing, setFinishing] = useState(false);
    const [showConfirm, setShowConfirm] = useState<"transfer" | "reactivate" | "finish" | null>(null);
    const [showTagModal, setShowTagModal] = useState(false);
    const [waitingCount, setWaitingCount] = useState(0);
    const prevWaitingCountRef = useRef<number>(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Badge de novas mensagens para aba Equipe
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
    const prevLastMessageAtRef = useRef<Record<string, string | null>>({});
    // Ref para acessar o selectedChat dentro de callbacks sem dependência circular
    const selectedChatRef = useRef<Chat | null>(null);
    // Ref do user para evitar closure stale dentro de useCallback sem adicionar user nas deps
    const userRef = useRef(user);
    // Ref para comunicar som pendente entre o setState (assíncrono) e o código externo
    const soundPendingRef = useRef<boolean>(false);

    // Toca um bip curto quando chega novo atendimento em espera
    function playAlertSound() {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            osc.type = "sine";
            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 1.2);
            osc.onended = () => ctx.close();
        } catch { /* browser sem suporte a AudioContext */ }
    }

    // Som de notificação estilo WhatsApp (duplo-pop curto) para novas mensagens no chat
    function playMessageNotificationSound() {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            // Primeiro pop
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.frequency.value = 1200;
            osc1.type = "sine";
            gain1.gain.setValueAtTime(0.3, ctx.currentTime);
            gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
            osc1.start(ctx.currentTime);
            osc1.stop(ctx.currentTime + 0.12);
            // Segundo pop (mais agudo)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.value = 1500;
            osc2.type = "sine";
            gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.15);
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc2.start(ctx.currentTime + 0.15);
            osc2.stop(ctx.currentTime + 0.3);
            osc2.onended = () => ctx.close();
        } catch { /* browser sem suporte a AudioContext */ }
    }
    const [transferReason, setTransferReason] = useState("");
    const [transferSummary, setTransferSummary] = useState("");
    const [transferType, setTransferType] = useState<"human" | "external">("human");
    const [departments, setDepartments] = useState<any[]>([]);
    const [selectedDepartment, setSelectedDepartment] = useState("");
    const [externalContacts, setExternalContacts] = useState<any[]>([]);
    const [selectedExternalContact, setSelectedExternalContact] = useState("");
    const [availableTags, setAvailableTags] = useState<ChatTag[]>([]);
    const [applyingTag, setApplyingTag] = useState(false);
    const [departmentAgents, setDepartmentAgents] = useState<{ id: string; name: string }[]>([]);
    const [selectedAgent, setSelectedAgent] = useState("");
    const [loadingAgents, setLoadingAgents] = useState(false);
    
    // States Mídia
    const [attachment, setAttachment] = useState<File | null>(null);
    const [uploadingMedia, setUploadingMedia] = useState(false);

    // States Áudio
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const clearAttachment = () => {
        setAttachment(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const fetchChats = useCallback(async (currentPage: number, isPolling = false) => {
        if (!isPolling && currentPage > 1) {
            setLoadingMore(true);
        } else if (!isPolling && currentPage === 1) {
            setLoadingChats(true);
        }

        try {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            params.set("tab", tab);
            
            // Tratamento especial para polling:
            // Para não perder a visão das conversas velhas que rolaram, 
            // no polling buscamos desde a pagina 1 até a última visível
            if (isPolling) {
                params.set("page", "1");
                params.set("limit", (currentPage * 20).toString());
            } else {
                params.set("page", currentPage.toString());
                params.set("limit", "20");
            }

            const res = await fetch(`/api/chats?${params.toString()}&_t=${Date.now()}`, { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json();
            
            const fetchedChats = data.chats || [];

            if (isPolling || currentPage === 1) {
                setChats(fetchedChats);
            } else {
                setChats(prev => {
                    // Evitar duplicados (embora db mude, garantimos uniqueness por ID)
                    const existingIds = new Set(prev.map(c => c.id));
                    const novosUnicos = fetchedChats.filter((c: Chat) => !existingIds.has(c.id));
                    return [...prev, ...novosUnicos];
                });
            }

            // Descobrir se há mais se a chamada retornou a mesma quantidade do limit (20)
            if (!isPolling) {
                setHasMore(fetchedChats.length === 20);
            }

            // Detectar novas mensagens para badge (apenas quando é polling)
            if (isPolling) {
                // ── FASE 1 (SÍNCRONA): calcular tudo ANTES de qualquer setState ──
                // Isso garante que shouldPlaySound não depende do batch assíncrono do React 18
                let shouldPlaySound = false;
                const newUnreadIncrements: Record<string, number> = {};

                for (const chat of fetchedChats) {
                    if (!chat.last_message_at) continue;
                    const prevAt = prevLastMessageAtRef.current[chat.id];
                    const isCurrentlyOpen = selectedChatRef.current?.id === chat.id;
                    const prevTime = prevAt ? new Date(prevAt).getTime() : 0;
                    const newTime = new Date(chat.last_message_at).getTime();

                    if (prevAt && newTime > prevTime && !isCurrentlyOpen) {
                        newUnreadIncrements[chat.id] = 1;
                        // Som: responsável pelo chat OU admin
                        // userRef.current evita closure stale (user não está nas deps do useCallback)
                        const currentUser = userRef.current;
                        if (chat.assigned_to === currentUser?.id || currentUser?.role === "admin") {
                            shouldPlaySound = true;
                        }
                    }
                    // Atualiza o baseline síncrono ANTES do setState
                    prevLastMessageAtRef.current[chat.id] = chat.last_message_at;
                }

                // ── FASE 2: aplicar incrementos ao state ──
                if (Object.keys(newUnreadIncrements).length > 0) {
                    setUnreadCounts(prev => {
                        const updated = { ...prev };
                        for (const [id, inc] of Object.entries(newUnreadIncrements)) {
                            updated[id] = (updated[id] ?? 0) + inc;
                        }
                        return updated;
                    });
                }

                // ── FASE 3: tocar som (variável local, 100% síncrona) ──
                if (shouldPlaySound) {
                    playMessageNotificationSound();
                }
            } else {
                // Na carga inicial, apenas registra os timestamps sem gerar badges
                for (const chat of fetchedChats) {
                    if (!prevLastMessageAtRef.current[chat.id]) {
                        prevLastMessageAtRef.current[chat.id] = chat.last_message_at;
                    }
                }
            }

        } catch (err) {
            console.error("Erro ao buscar chats:", err);
        } finally {
            if (!isPolling && currentPage > 1) {
                setLoadingMore(false);
            } else if (!isPolling && currentPage === 1) {
                setLoadingChats(false);
            }
        }
    }, [search, tab]);

    // Função para trocar de aba limpando o contexto da aba anterior
    const handleTabChange = useCallback((newTab: "ai" | "waiting" | "human") => {
        if (newTab === tab) return;
        setSelectedChat(null);
        setLinkedPatient(null);
        setPatientForm({ nome: "", telefone_principal: "", cpf: "", email: "", data_nascimento: "" });
        setShowHistory(false);
        setHistoryMessages([]);
        setMessages([]);
        setTab(newTab);
    }, [tab]);

    // Reseta página e chats quando os filtros mudam
    useEffect(() => {
        setPage(1);
        setHasMore(true);
        fetchChats(1, false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, tab, fetchChats]);

    const loadMoreChats = useCallback(() => {
        if (!loadingMore && !loadingChats && hasMore) {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchChats(nextPage, false);
        }
    }, [page, hasMore, loadingMore, loadingChats, fetchChats]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const bottom = e.currentTarget.scrollHeight - e.currentTarget.scrollTop <= e.currentTarget.clientHeight + 20;
        if (bottom) {
            loadMoreChats();
        }
    };

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

    // Polling a cada 8 segundos para lista lateral — reduzido para detecção mais rápida de novas mensagens
    useEffect(() => {
        const interval = setInterval(() => {
            fetchChats(page, true);
        }, 8000);
        return () => clearInterval(interval);
    }, [fetchChats, page]);

    // Sincroniza refs de selectedChat e user para uso seguro dentro de callbacks
    useEffect(() => {
        selectedChatRef.current = selectedChat;
    }, [selectedChat]);

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    // Polling a cada 10 segundos para contagem de chats em espera
    const fetchWaitingCount = useCallback(async () => {
        try {
            const res = await fetch(`/api/chats/count?_t=${Date.now()}`, { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json();
            const newCount: number = data.waiting ?? 0;

            // Detecta aumento: se aumentou E usuário não está na aba Em Espera, alerta sonoro
            if (newCount > prevWaitingCountRef.current && tab !== "waiting") {
                playAlertSound();
            }
            prevWaitingCountRef.current = newCount;
            setWaitingCount(newCount);
        } catch {
            // Silencia erros de rede para não poluir o console
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    useEffect(() => {
        fetchWaitingCount();
        const interval = setInterval(fetchWaitingCount, 10000);
        return () => clearInterval(interval);
    }, [fetchWaitingCount]);

    // Zera badge quando usuário navega para a aba Em Espera
    useEffect(() => {
        if (tab === "waiting") setWaitingCount(0);
    }, [tab]);

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

    // Fetch Departamentos e Contatos Externos para o Modal
    useEffect(() => {
        fetch("/api/departments").then(res => res.json()).then(data => {
            if (data.departments) setDepartments(data.departments.filter((d: any) => d.active));
        }).catch(err => console.error(err));
        
        fetch("/api/external-contacts").then(res => res.json()).then(data => {
            if (data.externalContacts) setExternalContacts(data.externalContacts.filter((e: any) => e.active));
        }).catch(err => console.error(err));
        
        fetch("/api/tags").then(res => res.json()).then(data => {
            if (data.tags) setAvailableTags(data.tags);
        }).catch(err => console.error(err));
    }, []);

    // Carrega atendentes do departamento selecionado
    useEffect(() => {
        if (!selectedDepartment) {
            setDepartmentAgents([]);
            setSelectedAgent("");
            return;
        }
        setLoadingAgents(true);
        setSelectedAgent("");
        fetch(`/api/departments/${selectedDepartment}/agents`)
            .then(res => res.json())
            .then(data => setDepartmentAgents(data.agents || []))
            .catch(err => console.error("Erro ao buscar atendentes:", err))
            .finally(() => setLoadingAgents(false));
    }, [selectedDepartment]);

    const handleSelectChat = (chat: Chat) => {
        if (selectedChat?.id === chat.id) return;
        setSelectedChat(chat);
        setLinkedPatient(null);
        setPatientForm({ nome: "", telefone_principal: "", cpf: "", email: "", data_nascimento: "" });
        setShowHistory(false);
        setHistoryMessages([]);
        setMessages([]);
        // Zera o badge de não lido ao abrir a conversa
        setUnreadCounts(prev => ({ ...prev, [chat.id]: 0 }));
        // Atualiza o timestamp visto para o atual do chat
        prevLastMessageAtRef.current[chat.id] = chat.last_message_at;
    };

    const formatPhoneMask = (v: string) => {
        const d = v.replace(/\D/g, "");
        if (d.length <= 12) {
            return d.replace(/(\d{2})(\d{2})(\d{4})(\d{4})/, "+$1 ($2) $3-$4");
        }
        return d.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, "+$1 ($2) $3-$4");
    };

    const handleOpenPatientModal = async () => {
        if (!selectedChat) return;
        setSavingPatient(true);
        setShowPatientModal(true);
        try {
            const res = await fetch(`/api/patients/find-by-phone?phone=${selectedChat.phone}`);
            if (res.ok) {
                const data = await res.json();
                if (data.patient) {
                    setLinkedPatient(data.patient);
                    setPatientForm({
                        id: data.patient.id,
                        nome: data.patient.nome,
                        telefone_principal: data.patient.telefone_principal,
                        cpf: data.patient.cpf || "",
                        email: data.patient.email || "",
                        data_nascimento: data.patient.data_nascimento ? data.patient.data_nascimento.split("T")[0] : ""
                    });
                } else {
                    setLinkedPatient(null);
                    setPatientForm({ nome: "", telefone_principal: selectedChat.phone || "", cpf: "", email: "", data_nascimento: "" });
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSavingPatient(false);
        }
    };

    const handleSavePatient = async () => {
        setSavingPatient(true);
        try {
            const method = linkedPatient ? "PUT" : "POST";
            const url = linkedPatient ? `/api/patients/${linkedPatient.id}` : "/api/patients";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patientForm)
            });
            if (res.ok) {
                toast.success(linkedPatient ? "Contato atualizado" : "Contato cadastrado");
                setShowPatientModal(false);
                setChats(prev => prev.map(c => c.phone === selectedChat?.phone ? { ...c, patient_name: patientForm.nome } : c));
                if (selectedChat) setSelectedChat({ ...selectedChat, patient_name: patientForm.nome });
            } else {
                toast.error("Erro ao salvar contato");
            }
        } catch (error) {
            toast.error("Erro ao salvar contato");
        } finally {
            setSavingPatient(false);
        }
    };

    const fetchConsolidatedHistory = async (pageToFetch = 1) => {
        if (!selectedChat) return;
        setHistoryLoading(true);
        try {
            const res = await fetch(`/api/chats/consolidated-history?phone=${selectedChat.phone}&page=${pageToFetch}&limit=60`);
            if (res.ok) {
                const data = await res.json();
                if (pageToFetch === 1) {
                    setHistoryMessages(data.messages);
                } else {
                    setHistoryMessages(prev => [...prev, ...data.messages]);
                }
                setHistoryTotal(data.total);
                setHistoryPage(data.page);
                setHistoryChatsCount(data.chatsCount);
            }
        } catch (error) {
            console.error("Erro histórico", error);
            toast.error("Erro ao carregar histórico");
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleOpenHistory = () => {
        if (showHistory) {
            setShowHistory(false);
            return;
        }
        setShowHistory(true);
        fetchConsolidatedHistory(1);
    };

    const handleTransfer = async () => {
        if (!selectedChat) return;
        if (!transferReason.trim() || !transferSummary.trim()) {
            toast.error("Preencha o motivo e resumo");
            return;
        }
        if (transferType === "human" && !selectedDepartment) {
            toast.error("Selecione um departamento.");
            return;
        }
        if (transferType === "external" && !selectedExternalContact) {
            toast.error("Selecione um contato externo.");
            return;
        }

        setTransferring(true);
        try {
            const res = await fetch(`/api/chats/${selectedChat.id}/transfer`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    reason: transferReason.trim(),
                    summary: transferSummary.trim(),
                    transfer_type: transferType,
                    department_id: transferType === "human" ? selectedDepartment : undefined,
                    assigned_to: transferType === "human" && selectedAgent ? selectedAgent : undefined,
                    external_contact_id: transferType === "external" ? selectedExternalContact : undefined
                })
            });
            if (!res.ok) throw new Error();

            toast.success(transferType === "human" ? "Conversa transferida para equipe!" : "Atendimento transferido!");
            setShowConfirm(null);

            // Remover chat da lista local para forçar o recarregamento natural ou esconder
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

    const handleAssume = async () => {
        if (!selectedChat) return;
        setAssuming(true);
        try {
            const res = await fetch(`/api/chats/${selectedChat.id}/assume`, { method: "POST" });
            if (!res.ok) throw new Error();
            const data = await res.json();
            toast.success("Atendimento assumido com sucesso!");
            // Atualizar o chat selecionado com os dados retornados pela API (agora ai_service="paused")
            const updatedChat: Chat = {
                ...selectedChat,
                ai_service: "paused",
                assigned_to: data.chat?.assigned_to ?? selectedChat.assigned_to,
                assigned_user_name: data.chat?.assigned_user_name ?? selectedChat.assigned_user_name,
            };
            setSelectedChat(updatedChat);
            // Mudar para aba "human" — o useEffect de [tab] vai recarregar a lista
            setTab("human");
        } catch {
            toast.error("Erro ao assumir atendimento");
        } finally {
            setAssuming(false);
        }
    };

    const handleApplyTag = async (tagId: string) => {
        if (!selectedChat) return;
        setApplyingTag(true);
        try {
            const res = await fetch(`/api/chats/${selectedChat.id}/tags`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tag_id: tagId }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Erro ao aplicar tag");
            }
            const data = await res.json();
            
            // Atualizar o chat selecionado
            const updatedTags = [...(selectedChat.tags || []), data.tag];
            const updatedChat = { ...selectedChat, tags: updatedTags };
            setSelectedChat(updatedChat);
            // Atualizar na lista
            setChats(prev => prev.map(c => c.id === selectedChat.id ? updatedChat : c));
            
            toast.success("Tag aplicada!");
        } catch (err: any) {
            toast.error(err?.message || "Erro ao aplicar tag");
        } finally {
            setApplyingTag(false);
        }
    };

    const handleRemoveTag = async (tagId: string) => {
        if (!selectedChat) return;
        try {
            const res = await fetch(`/api/chats/${selectedChat.id}/tags?tag_id=${tagId}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Erro ao remover tag");
            
            // Atualizar o chat selecionado
            const updatedTags = (selectedChat.tags || []).filter(t => t.id !== tagId);
            const updatedChat = { ...selectedChat, tags: updatedTags };
            setSelectedChat(updatedChat);
            // Atualizar na lista
            setChats(prev => prev.map(c => c.id === selectedChat.id ? updatedChat : c));
            
            toast.success("Tag removida!");
        } catch (err: any) {
            toast.error(err?.message || "Erro ao remover tag");
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedChat || (!messageInput.trim() && !attachment)) return;
        setSendingMessage(true);
        setUploadingMedia(true);

        try {
            // 1. Se tem anexo — converte para base64 e envia direto (URL R2 é privada e Uazapi não acessa)
            if (attachment) {
                // Determinar tipo de mídia pelo MIME type
                let mediaType = "document";
                if (attachment.type.startsWith("image/")) mediaType = "image";
                else if (attachment.type.startsWith("audio/")) mediaType = "audio";
                else if (attachment.type.startsWith("video/")) mediaType = "video";

                // Conversão para base64
                const base64Url = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(attachment);
                });

                const res = await fetch(`/api/chats/${selectedChat.id}/send-media`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        mediaUrl: base64Url,
                        mediaType,
                        fileName: attachment.name,
                        caption: messageInput.trim() || undefined
                    }),
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error || `Erro no envio de mídia (${res.status})`);
                }
                const data = await res.json();
                if (data.warning) toast(data.warning, { icon: "⚠️" });
                setMessages((prev) => [...prev, data.message]);
            } else {
                // Mensagem de texto normal
                const res = await fetch(`/api/chats/${selectedChat.id}/send-message`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ message: messageInput.trim() }),
                });

                if (!res.ok) throw new Error();
                const data = await res.json();
                setMessages((prev) => [...prev, data.message]);
            }

            setMessageInput("");
            clearAttachment();

            // Pausar UI (o backend já pausou a IA localmente sem transferir à equipe)
            setSelectedChat((prev) => prev ? { ...prev, ai_service: "paused" } : null);
            setChats((prev) => prev.map((c) => c.id === selectedChat.id ? { ...c, ai_service: "paused" } : c));

            // Rola pro fim
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        } catch (err: any) {
            console.error("Erro ao enviar mensagem:", err);
            toast.error(err?.message || "Erro ao enviar mensagem");
        } finally {
            setSendingMessage(false);
            setUploadingMedia(false);
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


    const isAiActive = (service: string | null | undefined) => {
        if (!service) return false;
        const s = String(service).toLowerCase();
        return s === "active" || s === "true";
    };

    const getStatusInfo = (service: string | null | undefined, deptName?: string | null) => {
        const s = String(service || "").toLowerCase();
        if (s === "active" || s === "true") return { label: "IA Ativa", emoji: "🟢", color: "bg-emerald-500", badgeClass: "bg-emerald-500/15 text-emerald-400" };
        if (s === "paused") return { label: "Atendimento Equipe", emoji: "🟠", color: "bg-amber-500", badgeClass: "bg-amber-500/15 text-amber-400" };
        if (s === "waiting") {
            const label = deptName ? `Aguardando: ${deptName}` : "Aguardando: Geral";
            return { label, emoji: "⏳", color: "bg-orange-500", badgeClass: "bg-orange-500/15 text-orange-400" };
        }
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
        setTransferType("human");
        setSelectedDepartment("");
        setSelectedAgent("");
        setSelectedExternalContact("");
        setShowConfirm("transfer");
    };

    // ── Gravação de Áudio ──────────────────────────────
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
                setAttachment(audioFile);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingSeconds(0);
            timerIntervalRef.current = setInterval(() => {
                setRecordingSeconds(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Erro ao acessar microfone:', err);
            toast.error('Não foi possível acessar o microfone. Verifique as permissões.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
        }
    };

    const formatRecordingTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const handleDeleteMessage = async (msgId: string) => {
        if (!selectedChat) return;
        if (!confirm("Tem certeza que deseja apagar esta mensagem para todos?")) return;
        
        try {
            const res = await fetch(`/api/chats/${selectedChat.id}/messages/${msgId}`, {
                method: "DELETE",
            });
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error || "Erro ao apagar mensagem");
            }
            
            setMessages((prev) =>
                prev.map((m) => (m.id === msgId ? { ...m, bot_message: "🚫 Mensagem apagada", deleted_at: data.deleted_at || new Date().toISOString() } : m))
            );
            toast.success("Mensagem apagada com sucesso");
        } catch (err: any) {
            console.error("Erro ao apagar:", err);
            toast.error(err.message || "Não foi possível apagar a mensagem");
        }
    };

    const isHistoryView = selectedChat ? (selectedChat.finished || ["finished", "transferred_external", "transferred"].includes(String(selectedChat.status || selectedChat.ai_service))) : false;
    // Somente o atendente responsável pode interagir (quando ai_service === "paused")
    const canInteract = selectedChat ? (
        selectedChat.ai_service !== "paused" || // IA ativa/waiting: botões de ação normais
        selectedChat.assigned_to === user?.id   // Paused: só quem assumiu
    ) : false;

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
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="transfer_type"
                                            value="human"
                                            checked={transferType === "human"}
                                            onChange={() => setTransferType("human")}
                                            className="w-4 h-4 text-amber-500 bg-slate-800 border-slate-600 focus:ring-amber-500"
                                        />
                                        Equipe (Atendente)
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="transfer_type"
                                            value="external"
                                            checked={transferType === "external"}
                                            onChange={() => setTransferType("external")}
                                            className="w-4 h-4 text-amber-500 bg-slate-800 border-slate-600 focus:ring-amber-500"
                                        />
                                        Contato Externo
                                    </label>
                                </div>
                                {transferType === "human" && (
                                    <>
                                        <div>
                                            <label className="text-xs font-medium text-slate-400 mb-1 block">Departamento</label>
                                            <select
                                                value={selectedDepartment}
                                                onChange={e => setSelectedDepartment(e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                            >
                                                <option value="">Selecione um departamento</option>
                                                {departments.map(d => (
                                                    <option key={d.id} value={d.id}>{d.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {selectedDepartment && (
                                            <div>
                                                <label className="text-xs font-medium text-slate-400 mb-1 block">
                                                    Atendente <span className="text-slate-600">(opcional)</span>
                                                </label>
                                                <select
                                                    value={selectedAgent}
                                                    onChange={e => setSelectedAgent(e.target.value)}
                                                    disabled={loadingAgents}
                                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-60"
                                                >
                                                    <option value="">Nenhum — Geral do departamento</option>
                                                    {loadingAgents ? (
                                                        <option disabled>Carregando...</option>
                                                    ) : departmentAgents.length === 0 ? (
                                                        <option disabled>Nenhum atendente neste departamento</option>
                                                    ) : (
                                                        departmentAgents.map(a => (
                                                            <option key={a.id} value={a.id}>{a.name}</option>
                                                        ))
                                                    )}
                                                </select>
                                            </div>
                                        )}
                                    </>
                                )}
                                {transferType === "external" && (
                                    <div>
                                        <label className="text-xs font-medium text-slate-400 mb-1 block">Contato Externo</label>
                                        <select
                                            value={selectedExternalContact}
                                            onChange={e => setSelectedExternalContact(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                        >
                                            <option value="">Selecione um contato</option>
                                            {externalContacts.map(e => (
                                                <option key={e.id} value={e.id}>{e.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
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
                                        placeholder="Breve resumo para o responsável que vai assumir..."
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

            {/* Tag Modal */}
            {showTagModal && selectedChat && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                                <Tag className="w-5 h-5 text-violet-400" />
                                Adicionar Tag
                            </h3>
                            <button onClick={() => setShowTagModal(false)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                            {availableTags.filter(t => !(selectedChat.tags || []).some(applied => applied.id === t.id)).length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-4">Nenhuma tag disponível para adicionar.</p>
                            ) : (
                                availableTags
                                    .filter(t => !(selectedChat.tags || []).some(applied => applied.id === t.id))
                                    .map(tag => (
                                        <button
                                            key={tag.id}
                                            onClick={() => handleApplyTag(tag.id)}
                                            disabled={applyingTag}
                                            className="w-full flex items-center gap-3 p-3 bg-slate-900 border border-slate-700 rounded-xl hover:border-slate-500 transition-colors disabled:opacity-50 text-left"
                                        >
                                            <span 
                                                className="w-3 h-3 rounded-full shrink-0" 
                                                style={{ backgroundColor: tag.color }}
                                            />
                                            <span className="text-sm font-medium text-white flex-1">{tag.name}</span>
                                            <Plus className="w-4 h-4 text-slate-400" />
                                        </button>
                                    ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Painel Esquerdo - Lista de Conversas */}
            <div className={`w-80 border-r border-slate-800 bg-slate-900/50 flex flex-col shrink-0 ${isHistoryView ? 'hidden' : ''}`}>
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
                        <div className="flex gap-1 p-1 bg-slate-800 rounded-xl">
                            <button
                                onClick={() => handleTabChange("ai")}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    tab === "ai" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
                                }`}
                            >
                                Atend. IA
                            </button>
                            <button
                                onClick={() => handleTabChange("waiting")}
                                className={`flex-1 relative flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    tab === "waiting"
                                        ? "bg-orange-600 text-white shadow"
                                        : waitingCount > 0
                                        ? "text-orange-400 hover:text-white animate-pulse bg-orange-500/10"
                                        : "text-slate-400 hover:text-white"
                                }`}
                            >
                                Em Espera
                                {waitingCount > 0 && tab !== "waiting" && (
                                    <span className="absolute -top-1.5 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-red-500/40 border border-slate-800">
                                        {waitingCount > 99 ? "99+" : waitingCount}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => handleTabChange("human")}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    tab === "human" ? "bg-amber-600 text-white shadow" : "text-slate-400 hover:text-white"
                                }`}
                            >
                                Equipe
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto" onScroll={handleScroll}>
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
                            {chats.map((chat) => {
                                const unread = tab === "human" ? (unreadCounts[chat.id] ?? 0) : 0;
                                const isSelected = selectedChat?.id === chat.id;
                                return (
                                <div
                                    key={chat.id}
                                    onClick={() => handleSelectChat(chat)}
                                    className={`p-4 cursor-pointer transition-all hover:bg-slate-800 ${isSelected
                                        ? "bg-slate-800 border-l-2 border-blue-500"
                                        : unread > 0
                                        ? "border-l-2 border-red-500 bg-red-500/5"
                                        : "border-l-2 border-transparent"
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-1">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                {/* Badge de não lido */}
                                                {unread > 0 && !isSelected && (
                                                    <span className="min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-red-500/50 animate-pulse shrink-0">
                                                        {unread > 99 ? "99+" : unread}
                                                    </span>
                                                )}
                                                <span className={`font-medium text-sm ${unread > 0 && !isSelected ? "text-white" : "text-slate-200"} truncate max-w-[150px]`}>
                                                    {chat.patient_name ? chat.patient_name : formatPhone(chat.phone)}
                                                </span>
                                            </div>
                                            {chat.patient_name && (
                                                <span className="text-[11px] text-slate-500 mt-0.5">
                                                    {formatPhone(chat.phone)}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-slate-500">{formatDate(chat.last_message_at || chat.updated_at)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusInfo(chat.ai_service, chat.department_name).color}`} />
                                        <span className="text-xs text-slate-400">{getStatusInfo(chat.ai_service, chat.department_name).label}</span>
                                        {chat.assigned_user_name && (
                                            <span className="ml-auto text-[11px] text-amber-400/80 font-medium truncate max-w-[100px]">
                                                {chat.assigned_user_name}
                                            </span>
                                        )}
                                    </div>
                                    {chat.tags && chat.tags.length > 0 && (
                                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                            {chat.tags.map(t => (
                                                <span 
                                                    key={t.id} 
                                                    className="text-[9px] px-1.5 py-0.5 rounded border font-medium truncate max-w-[120px]"
                                                    style={{ backgroundColor: `${t.color}20`, borderColor: `${t.color}40`, color: t.color }}
                                                    title={t.name}
                                                >
                                                    {t.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    )}
                    {loadingMore && (
                        <div className="flex items-center justify-center p-4">
                            <span className="w-5 h-5 border-2 border-slate-500/30 border-t-slate-500 rounded-full animate-spin" />
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
                                {isHistoryView && (
                                    <button 
                                        onClick={() => router.push('/dashboard/history')} 
                                        className="mr-2 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center justify-center bg-slate-800/50"
                                        title="Voltar ao Histórico"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>
                                )}
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center overflow-hidden">
                                    {selectedChat.patient_name ? (
                                        <span className="text-white font-bold text-sm uppercase">
                                            {selectedChat.patient_name.charAt(0)}
                                        </span>
                                    ) : (
                                        <Phone className="w-4 h-4 text-white" />
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-white">
                                            {selectedChat.patient_name ? selectedChat.patient_name : formatPhone(selectedChat.phone)}
                                            {isHistoryView && (
                                                <span className="ml-2 px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] rounded border border-slate-700">Somente Leitura</span>
                                            )}
                                        </p>
                                    </div>
                                    {selectedChat.patient_name && (
                                        <span className="text-[11px] text-slate-400">
                                            {formatPhone(selectedChat.phone)}
                                        </span>
                                    )}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusInfo(selectedChat.ai_service, selectedChat.department_name).badgeClass}`}>
                                            {getStatusInfo(selectedChat.ai_service, selectedChat.department_name).emoji} {getStatusInfo(selectedChat.ai_service, selectedChat.department_name).label}
                                        </span>
                                        {selectedChat.assigned_user_name && (
                                            <span className="text-xs text-amber-400/80 font-medium">
                                                Atendente: {selectedChat.assigned_user_name}
                                            </span>
                                        )}
                                        {selectedChat.tags && selectedChat.tags.map(t => (
                                            <span 
                                                key={t.id} 
                                                className="flex items-center gap-1 text-[10px] pl-2 pr-1 py-0.5 rounded-full border shadow-sm"
                                                style={{ backgroundColor: `${t.color}15`, borderColor: `${t.color}30`, color: t.color }}
                                            >
                                                {t.name}
                                                {!isHistoryView && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleRemoveTag(t.id); }}
                                                        className="hover:bg-black/20 rounded-full p-0.5 transition-colors"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </span>
                                        ))}
                                        {!isHistoryView && (
                                            <button
                                                onClick={() => setShowTagModal(true)}
                                                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-dashed border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
                                            >
                                                <Plus className="w-3 h-3" /> Tag
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2">
                                {!isHistoryView && canInteract && (
                                    <>
                                        <button
                                            onClick={handleOpenPatientModal}
                                            title={selectedChat.patient_name ? "Editar Contato" : "Adicionar Contato"}
                                            className="p-2 rounded-xl text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-all flex items-center gap-1"
                                        >
                                            {selectedChat.patient_name ? <User className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={handleOpenHistory}
                                            title="Histórico Consolidado"
                                            className={`p-2 rounded-xl transition-all flex items-center gap-1 ${showHistory ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 hover:text-blue-400 hover:bg-slate-800'}`}
                                        >
                                            <History className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                                <button
                                    id="btn-refresh-messages"
                                    onClick={() => fetchMessages(selectedChat.id)}
                                    title="Atualizar mensagens"
                                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                                {!isHistoryView && (
                                    selectedChat.ai_service === "waiting" ? (
                                        // Em Espera: apenas botão Assumir
                                        <button
                                            id="btn-assume-chat"
                                            onClick={handleAssume}
                                            disabled={assuming}
                                            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-60"
                                        >
                                            <UserCheck className="w-4 h-4" />
                                            <span className="hidden sm:block">{assuming ? "Assumindo..." : "Assumir Atendimento"}</span>
                                        </button>
                                    ) : selectedChat.ai_service === "paused" && canInteract ? (
                                        // Atendimento Humano ativo (responsável): Transferir + Finalizar
                                        <>
                                            <button
                                                id="btn-transfer-department"
                                                onClick={openTransferModal}
                                                disabled={transferring}
                                                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-60"
                                            >
                                                <UserCheck className="w-4 h-4" />
                                                <span className="hidden sm:block">Transferir</span>
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
                                    ) : selectedChat.ai_service === "paused" && !canInteract ? (
                                        // Outro atendente visualizando — sem botões de ação
                                        <span className="text-xs text-slate-500 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700">
                                            🔒 Responsável: {selectedChat.assigned_user_name}
                                        </span>
                                    ) : (
                                        // IA ativa: Transferir para Humano
                                        <button
                                            id="btn-transfer-human"
                                            onClick={openTransferModal}
                                            disabled={transferring}
                                            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-60"
                                        >
                                            <UserCheck className="w-4 h-4" />
                                            <span className="hidden sm:block">Transferir para Humano</span>
                                        </button>
                                    )
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
                                (messages.map((msg, index) => {
                                    const isInactive = msg.active === false;
                                    // Determina se a mensagem foi enviada por um atendente humano (tem sender_name)
                                    const isHumanAgent = !!msg.sender_name;

                                    // Helper: renderiza o card de mídia correto em qualquer bolha
                                    const renderMedia = (side: "patient" | "agent") => {
                                        if (!msg.media_url) return null;
                                        const isPdf = msg.media_type === "document" || msg.media_type === "pdf" ||
                                            msg.media_url?.toLowerCase().includes(".pdf") ||
                                            (msg.media_name?.toLowerCase().endsWith(".pdf") ?? false);

                                        if (msg.media_type === "image" && !isPdf) {
                                            return <img src={msg.media_url} alt="Imagem" className="rounded-lg max-w-full max-h-60 object-cover cursor-pointer hover:opacity-90 transition-opacity mb-2" onClick={() => window.open(msg.media_url!, '_blank')} />;
                                        }
                                        if (msg.media_type === "audio") {
                                            return <audio controls src={msg.media_url} className="h-10 w-48 scale-90 origin-left mb-1" />;
                                        }
                                        if (msg.media_type === "video") {
                                            return <video controls src={msg.media_url} className="rounded-lg max-w-full max-h-48 mb-2" />;
                                        }
                                        if (isPdf) {
                                            return (
                                                <a
                                                    href={msg.media_url}
                                                    target="_blank"
                                                    download={msg.media_name || "documento.pdf"}
                                                    rel="noreferrer"
                                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors group mb-2 no-underline ${
                                                        side === "agent"
                                                            ? "bg-emerald-800/60 border-emerald-600/40 hover:bg-emerald-800"
                                                            : "bg-slate-700 border-slate-600 hover:bg-slate-600"
                                                    }`}
                                                >
                                                    <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center shrink-0">
                                                        <FileText className="w-5 h-5 text-red-400" />
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-sm font-medium text-slate-100 truncate max-w-[160px]">{msg.media_name || "Documento PDF"}</span>
                                                        <span className="text-xs text-slate-400">Clique para baixar</span>
                                                    </div>
                                                    <Download className="w-4 h-4 text-slate-400 group-hover:text-white transition shrink-0 ml-auto" />
                                                </a>
                                            );
                                        }
                                        // Outros arquivos genéricos
                                        return (
                                            <a href={msg.media_url} target="_blank" rel="noreferrer" className={`flex items-center gap-2 px-3 py-2 rounded-lg no-underline transition-colors shrink-0 mb-1 ${
                                                side === "agent"
                                                    ? "bg-emerald-800/60 hover:bg-emerald-800 text-emerald-100"
                                                    : "bg-slate-700 hover:bg-slate-600 text-blue-400"
                                            }`}>
                                                <FileText className="w-4 h-4" />
                                                <span className="truncate max-w-[150px] font-medium text-sm">{msg.media_name || "Arquivo"}</span>
                                            </a>
                                        );
                                    };

                                    return (
                                        <div key={`${msg.id}-${index}`} className="flex flex-col gap-2">
                                            {/* Mensagem do paciente/lead (esquerda, cinza) */}
                                            {msg.user_message && (
                                                <div className="flex justify-start">
                                                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm bg-slate-700 text-slate-100 rounded-bl-sm ${msg.deleted_at ? "opacity-50 italic border border-dashed border-slate-600" : ""}`}>
                                                        {msg.deleted_at ? (
                                                            <div className="flex flex-col gap-1">
                                                                <span className="flex items-center gap-1.5 text-xs font-medium opacity-90 text-slate-300">
                                                                    <Trash2 className="w-3.5 h-3.5" /> Mensagem apagada do paciente
                                                                </span>
                                                                <span className="text-[10px] opacity-70">
                                                                    {msg.deleted_by_name ? `Removida por ${msg.deleted_by_name}` : "Removida"} em {formatDate(msg.deleted_at)}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {msg.media_url && renderMedia("patient")}
                                                                <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.user_message}</p>
                                                            </>
                                                        )}
                                                        <div className="flex items-center gap-1.5 mt-1 justify-start">
                                                            <span className="text-[10px] text-slate-400">{formatDate(msg.created_at)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {msg.media_url && !msg.user_message && !msg.bot_message && !msg.deleted_at && (
                                                <div className="flex justify-start">
                                                    <div className="max-w-[75%] px-4 py-2.5 rounded-2xl text-sm bg-slate-700 text-slate-100 rounded-bl-sm">
                                                        {renderMedia("patient")}
                                                        <div className="flex items-center gap-1.5 justify-start">
                                                            <span className="text-[10px] text-slate-400">{formatDate(msg.created_at)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Mensagem da IA/Atendente (direita) */}
                                            {msg.bot_message && (
                                                <div className="flex justify-end">
                                                    <div className="relative group max-w-[75%]">
                                                        {isHumanAgent && !msg.deleted_at && canInteract && (
                                                            <button
                                                                onClick={() => handleDeleteMessage(msg.id)}
                                                                title="Apagar mensagem"
                                                                className="absolute -left-10 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-full"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <div className={`px-4 py-2.5 rounded-2xl text-sm text-white rounded-br-sm ${
                                                            isHumanAgent
                                                                ? "bg-emerald-700"   // Atendente humano — verde
                                                                : "bg-blue-600"     // IA — azul
                                                        } ${msg.deleted_at ? "opacity-50 italic border border-dashed border-white/20" : ""}`}>
                                                            {msg.deleted_at ? (
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="flex items-center gap-1.5 text-xs font-medium opacity-90">
                                                                        <Trash2 className="w-3.5 h-3.5" /> Mensagem apagada
                                                                    </span>
                                                                    <span className="text-[10px] opacity-80">
                                                                        {msg.deleted_by_name ? `Removida por ${msg.deleted_by_name}` : "Removida"} em {formatDate(msg.deleted_at)}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    {msg.media_url && renderMedia("agent")}
                                                                    <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.bot_message}</p>
                                                                </>
                                                            )}
                                                            <div className="flex items-center gap-1.5 mt-1 justify-end">
                                                                <span className={`text-[10px] ${isHumanAgent ? "text-emerald-200/70" : "text-blue-200/70"}`}>
                                                                    {formatDate(msg.created_at)}
                                                                </span>
                                                                {msg.sender_name && (
                                                                    <span className={`text-[10px] font-medium ${isHumanAgent ? "text-emerald-200/60" : "text-blue-200/50"}`}>
                                                                        — {msg.sender_name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Send Message Area */}
                        {isHistoryView ? (
                            <div className="p-4 flex flex-col items-center justify-center bg-slate-900 border-t border-slate-800 shrink-0 select-none h-24">
                                <span className="text-slate-500 font-medium flex items-center gap-2 text-sm">
                                    <CheckCircle className="w-4 h-4" />
                                    Atendimento Finalizado
                                </span>
                                <span className="text-slate-600 text-xs mt-1">
                                    Histórico disponível apenas para visualização.
                                </span>
                            </div>
                        ) : !canInteract && selectedChat.ai_service === "paused" ? (
                            <div className="p-4 flex flex-col items-center justify-center bg-slate-900/80 border-t border-slate-800 shrink-0 select-none h-24">
                                <span className="text-amber-400/80 font-medium flex items-center gap-2 text-sm">
                                    🔒 Somente Visualização
                                </span>
                                <span className="text-slate-500 text-xs mt-1">
                                    Apenas o atendente responsável ({selectedChat.assigned_user_name || "—"}) pode interagir.
                                </span>
                            </div>
                        ) : (
                            <div className="border-t border-slate-800 flex flex-col bg-slate-900 shrink-0">
                                {/* Preview anexo */}
                                {attachment && (
                                    <div className="px-4 pt-3 flex items-center gap-3">
                                        <div className="relative bg-slate-800 p-2 rounded-lg border border-slate-700 flex items-center gap-3">
                                            <div className="p-2 bg-blue-500/10 rounded-md">
                                                {attachment.type.startsWith("image/") ? <ImageIcon className="w-5 h-5 text-blue-400" /> 
                                                : attachment.type.startsWith("audio/") ? <FileAudio className="w-5 h-5 text-amber-400" />
                                                : <FileText className="w-5 h-5 text-indigo-400" />}
                                            </div>
                                            <div className="flex flex-col max-w-[200px]">
                                                <span className="text-sm font-medium text-slate-200 truncate">{attachment.name}</span>
                                                <span className="text-xs text-slate-500">{(attachment.size / 1024).toFixed(1)} KB</span>
                                            </div>
                                            <button 
                                                onClick={clearAttachment} 
                                                className="absolute -top-2 -right-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-full p-1"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Forms Message */}
                                <form onSubmit={handleSendMessage} className="p-4 flex gap-3 items-center">
                                    {/* Upload hidden */}
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                setAttachment(e.target.files[0]);
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        title="Anexar arquivo ou imagem"
                                        className="p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
                                    >
                                        <Paperclip className="w-5 h-5" />
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={isRecording ? stopRecording : startRecording}
                                            title={isRecording ? "Parar gravação" : "Gravar áudio"}
                                            className={`p-3 rounded-xl transition-all ${isRecording ? "bg-red-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}
                                        >
                                            {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                                        </button>
                                        {isRecording && (
                                            <span className="text-sm font-mono font-semibold text-red-400 animate-pulse min-w-[44px]">
                                                {formatRecordingTime(recordingSeconds)}
                                            </span>
                                        )}
                                    </div>

                                    <input
                                        id="message-input"
                                        type="text"
                                        value={messageInput}
                                        onChange={(e) => setMessageInput(e.target.value)}
                                        placeholder={attachment ? "Digite uma legenda (opcional)..." : "Digite sua mensagem..."}
                                        disabled={sendingMessage}
                                        className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-60"
                                    />
                                    <button
                                        id="btn-send-message"
                                        type="submit"
                                        disabled={sendingMessage || (!messageInput.trim() && !attachment)}
                                        className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all disabled:opacity-60 flex items-center gap-2"
                                    >
                                        {uploadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    </button>
                                </form>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modal de Paciente / Contato */}
            {showPatientModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <User className="w-5 h-5 text-blue-400" />
                                {linkedPatient ? "Editar Contato" : "Novo Contato"}
                            </h3>
                            <button onClick={() => setShowPatientModal(false)} className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-700 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400">Nome Completo *</label>
                                <input
                                    type="text"
                                    value={patientForm.nome}
                                    onChange={(e) => setPatientForm({ ...patientForm, nome: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                    placeholder="Ex: João Silva"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400">Telefone *</label>
                                <input
                                    type="text"
                                    value={formatPhoneMask(patientForm.telefone_principal)}
                                    disabled
                                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-400 cursor-not-allowed"
                                />
                                <p className="text-[10px] text-slate-500">O telefone é vinculado automaticamente ao número do chat.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-400">CPF (opcional)</label>
                                    <input
                                        type="text"
                                        value={patientForm.cpf || ""}
                                        onChange={(e) => setPatientForm({ ...patientForm, cpf: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                        placeholder="000.000.000-00"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-400">Nascimento (opcional)</label>
                                    <input
                                        type="date"
                                        value={patientForm.data_nascimento || ""}
                                        onChange={(e) => setPatientForm({ ...patientForm, data_nascimento: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400">E-mail (opcional)</label>
                                <input
                                    type="email"
                                    value={patientForm.email || ""}
                                    onChange={(e) => setPatientForm({ ...patientForm, email: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                    placeholder="email@exemplo.com"
                                />
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-800 bg-slate-800/30 flex justify-end gap-3">
                            <button
                                onClick={() => setShowPatientModal(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSavePatient}
                                disabled={savingPatient || !patientForm.nome.trim()}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {savingPatient ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Salvar Contato
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Drawer de Histórico Consolidado */}
            {showHistory && (
                <div className="absolute right-0 top-0 h-full w-[400px] bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col z-40 transform transition-transform">
                    <div className="h-16 px-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-800/50">
                        <div className="flex items-center gap-2">
                            <History className="w-5 h-5 text-blue-400" />
                            <h3 className="text-white font-semibold">Histórico Consolidado</h3>
                        </div>
                        <button onClick={() => setShowHistory(false)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="px-4 py-3 border-b border-slate-800/50 bg-slate-900 shrink-0">
                        <p className="text-xs text-slate-400 text-center">
                            Exibindo <span className="font-medium text-white">{historyMessages.length}</span> de <span className="font-medium text-white">{historyTotal}</span> mensagens em <span className="font-medium text-white">{historyChatsCount}</span> atendimentos
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {historyLoading && historyPage === 1 ? (
                            <div className="flex justify-center py-8">
                                <span className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                            </div>
                        ) : historyMessages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-center text-slate-500">
                                <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                                <p className="text-sm">Nenhuma mensagem anterior encontrada.</p>
                            </div>
                        ) : (
                            <div className="space-y-4 pb-4">
                                {historyMessages.map((msg, index) => {
                                    // Determina se a mensagem mudou de atendimento (agrupamento por chat_id ou tempo)
                                    const prevMsg = index > 0 ? historyMessages[index - 1] : null;
                                    const isNewChat = !prevMsg || prevMsg.chat_id !== msg.chat_id;
                                    
                                    return (
                                        <div key={msg.id || index}>
                                            {isNewChat && (
                                                <div className="sticky top-0 z-10 flex justify-center my-6">
                                                    <span className="px-3 py-1 bg-slate-800/80 backdrop-blur-sm text-slate-300 text-[10px] uppercase font-bold tracking-wider rounded-full border border-slate-700 shadow-sm">
                                                        Atendimento: {msg.chat_created_at ? formatDate(msg.chat_created_at) : formatDate(msg.created_at)}
                                                    </span>
                                                </div>
                                            )}
                                            
                                            <div className={`flex w-full mb-3 ${msg.sender_type === "contact" ? "justify-start" : "justify-end"}`}>
                                                <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                                                    msg.sender_type === "contact" 
                                                        ? "bg-slate-800 text-slate-200 border border-slate-700/50 rounded-tl-sm" 
                                                        : "bg-blue-600 text-white rounded-tr-sm shadow-md"
                                                } ${msg.deleted_at ? "opacity-50 italic border border-dashed border-white/20" : ""}`}>
                                                    {msg.sender_type !== "contact" && (
                                                        <p className="text-[10px] font-medium opacity-70 mb-0.5">
                                                            {msg.sender_type === "bot" ? "Assistente IA" : msg.sender_name || "Equipe"}
                                                        </p>
                                                    )}
                                                    
                                                    {/* Conteúdo da Mensagem */}
                                                    {msg.deleted_at ? (
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="flex items-center gap-1 text-[10px] font-medium opacity-90">
                                                                <Trash2 className="w-3 h-3" /> Mensagem apagada
                                                            </span>
                                                            <span className="text-[9px] opacity-70 font-normal not-italic">
                                                                {msg.deleted_by_name ? `Por ${msg.deleted_by_name}` : "Sistema"} em {formatDate(msg.deleted_at)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {msg.message_type === "text" && (
                                                                <p className="text-xs break-words whitespace-pre-wrap leading-relaxed">
                                                                    {msg.user_message || msg.bot_message}
                                                                </p>
                                                            )}
                                                            {msg.message_type === "image" && (
                                                                <div className="space-y-1">
                                                                    <div className="relative group cursor-pointer border border-white/10 rounded-lg overflow-hidden flex items-center justify-center bg-black/20">
                                                                        <ImageIcon className="w-4 h-4 m-2 opacity-50" />
                                                                        <span className="text-[10px]">Imagem</span>
                                                                    </div>
                                                                    {(msg.user_message || msg.bot_message) && (
                                                                        <p className="text-xs break-words whitespace-pre-wrap leading-relaxed">
                                                                            {msg.user_message || msg.bot_message}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {/* Outros tipos omitidos para simplificar o preview */}
                                                            {["document", "audio", "video"].includes(msg.message_type) && (
                                                                <div className="flex items-center gap-2 bg-black/10 p-2 rounded-lg border border-white/5">
                                                                    <FileText className="w-4 h-4 opacity-70" />
                                                                    <span className="text-xs font-medium">Arquivo de Mídia</span>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}

                                                    <p className={`text-[9px] mt-1 text-right ${msg.sender_type === "contact" ? "text-slate-500" : "text-blue-200"}`}>
                                                        {formatDate(msg.created_at)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {historyMessages.length < historyTotal && (
                                    <button
                                        onClick={() => fetchConsolidatedHistory(historyPage + 1)}
                                        disabled={historyLoading}
                                        className="w-full py-2.5 mt-4 border border-dashed border-slate-700 rounded-xl text-xs text-slate-400 font-medium hover:text-white hover:border-slate-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {historyLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3" />}
                                        Carregar mais antigas
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
