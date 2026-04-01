"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    Send, FileText, Plus, Pencil, Trash2, Image as ImageIcon,
    X, Check, Clock, AlertCircle, ChevronRight, ChevronLeft,
    Search, Users, Calendar, Loader2, Eye, CheckCircle2,
    MessageSquare, Zap, ChevronDown, CalendarDays, Key
} from "lucide-react";
import toast from "react-hot-toast";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Template {
    id: string;
    name: string;
    body: string | null;
    image_url: string | null;
    image_caption: string | null;
    active: boolean;
    created_at: string;
}

interface Broadcast {
    id: string;
    template_id: string;
    template: { id: string; name: string } | null;
    status: string;
    scheduled_at: string | null;
    finished_at: string | null;
    total_recipients: number;
    sent_count: number;
    failed_count: number;
    created_at: string;
    recipients?: Recipient[];
}

interface Recipient {
    id: string;
    phone: string;
    name: string | null;
    status: string;
    sent_at: string | null;
    error: string | null;
}

interface Patient {
    id: string;
    nome: string | null;
    telefone_principal: string | null;
    cpf: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const WHATSAPP_CHAR_LIMIT = 65536;
const SCHEDULE_HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7..18

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    draft:      { label: "Rascunho",   color: "text-slate-400",   bg: "bg-slate-500/10",   icon: <FileText className="w-3 h-3" /> },
    scheduled:  { label: "Agendado",   color: "text-blue-400",    bg: "bg-blue-500/10",    icon: <Clock className="w-3 h-3" /> },
    processing: { label: "Enviando",   color: "text-amber-400",   bg: "bg-amber-500/10",   icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    completed:  { label: "Concluído",  color: "text-emerald-400", bg: "bg-emerald-500/10", icon: <CheckCircle2 className="w-3 h-3" /> },
    failed:     { label: "Falha",      color: "text-red-400",     bg: "bg-red-500/10",     icon: <AlertCircle className="w-3 h-3" /> },
    cancelled:  { label: "Cancelado",  color: "text-slate-500",   bg: "bg-slate-700/10",   icon: <X className="w-3 h-3" /> },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getProxiedImageUrl(url: string | null | undefined) {
    if (!url) return "";
    if (url.startsWith("blob:") || url.startsWith("data:") || url.startsWith("/")) return url;
    return `/api/media/proxy?url=${encodeURIComponent(url)}`;
}

function formatDate(d: string | null) {
    if (!d) return "—";
    try { return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch { return "—"; }
}

function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color} border border-current/20`}>
            {cfg.icon}{cfg.label}
        </span>
    );
}

// ─── WhatsApp Preview ────────────────────────────────────────────────────────

function WhatsAppPreview({ body, imageUrl, imageCaption }: { body?: string; imageUrl?: string; imageCaption?: string }) {
    const hasContent = body || imageUrl;
    if (!hasContent) return (
        <div className="flex items-center justify-center h-24 text-slate-600 text-xs">Sem conteúdo para pré-visualizar</div>
    );
    return (
        <div className="bg-[#0b141a] rounded-xl p-4 font-sans">
            <div className="flex justify-end">
                <div className="max-w-[85%] bg-[#005c4b] rounded-tl-xl rounded-bl-xl rounded-br-xl p-3 shadow-md text-white text-sm space-y-1.5">
                    {imageUrl && (
                        <div className="rounded-lg overflow-hidden bg-slate-800">
                            <img src={getProxiedImageUrl(imageUrl)} alt="preview" className="w-full object-cover max-h-48" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            {imageCaption && <p className="p-2 text-xs text-slate-300">{imageCaption}</p>}
                        </div>
                    )}
                    {body && <p className="whitespace-pre-wrap leading-relaxed">{body}</p>}
                    <p className="text-right text-[10px] text-emerald-200/60">agora ✓✓</p>
                </div>
            </div>
        </div>
    );
}

// ─── Template Modal ──────────────────────────────────────────────────────────

function TemplateModal({ template, onClose, onSave }: {
    template: Template | null;
    onClose: () => void;
    onSave: () => void;
}) {
    const [name, setName] = useState(template?.name || "");
    const [body, setBody] = useState(template?.body || "");
    // imageUrl = URL do R2 (existente para templates já salvos)
    const [imageUrl, setImageUrl] = useState(template?.image_url || "");
    const [imageCaption, setImageCaption] = useState(template?.image_caption || "");
    // selectedFile = arquivo selecionado que ainda não foi enviado ao R2
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    // previewUrl = blob URL local gerado a partir do selectedFile (sem rede)
    const [previewUrl, setPreviewUrl] = useState(template?.image_url || "");
    const [saving, setSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (file: File) => {
        // Revoga blob anterior para liberar memória do browser
        if (previewUrl && !imageUrl) URL.revokeObjectURL(previewUrl);
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setImageUrl(""); // nova imagem ancora nova URL do R2
    };

    const handleRemoveImage = () => {
        if (previewUrl && !imageUrl) URL.revokeObjectURL(previewUrl);
        setSelectedFile(null);
        setPreviewUrl("");
        setImageUrl("");
        setImageCaption("");
    };

    const handleSave = async () => {
        if (!name.trim()) { toast.error("Nome é obrigatório"); return; }
        setSaving(true);

        let finalImageUrl = imageUrl;

        // Se há um arquivo novo aguardando, faz o upload ao R2 agora
        if (selectedFile) {
            try {
                const formData = new FormData();
                formData.append("file", selectedFile);
                const res = await fetch("/api/media/upload", { method: "POST", body: formData });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || "Falha ao enviar a imagem");
                }
                const data = await res.json();
                finalImageUrl = data.url;
            } catch (err: any) {
                toast.error(err.message || "Erro ao fazer upload da imagem");
                setSaving(false);
                return;
            }
        }

        if (!body.trim() && !finalImageUrl) {
            toast.error("Adicione texto e/ou imagem");
            setSaving(false);
            return;
        }

        try {
            const url = template ? `/api/message-templates/${template.id}` : "/api/message-templates";
            const res = await fetch(url, {
                method: template ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, body: body || null, image_url: finalImageUrl || null, image_caption: imageCaption || null }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Erro ao salvar");
            }
            toast.success(template ? "Template atualizado!" : "Template criado!");
            onSave();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const charPercentage = Math.min((body.length / WHATSAPP_CHAR_LIMIT) * 100, 100);
    const charColor = body.length > WHATSAPP_CHAR_LIMIT * 0.9 ? "text-red-400" : body.length > WHATSAPP_CHAR_LIMIT * 0.7 ? "text-amber-400" : "text-emerald-400";

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <h3 className="text-white font-semibold text-lg">{template ? "Editar Template" : "Novo Template"}</h3>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-6 space-y-5">
                    {/* Nome */}
                    <div>
                        <label className="text-xs font-medium text-slate-400 mb-1.5 block">Nome do Template *</label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ex: Lembrete de Consulta"
                            maxLength={100}
                            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    {/* Imagem */}
                    <div>
                        <label className="text-xs font-medium text-slate-400 mb-1.5 block">Imagem (opcional)</label>
                        {previewUrl ? (
                            <div className="relative rounded-xl overflow-hidden bg-slate-800 border border-slate-700">
                                <img src={getProxiedImageUrl(previewUrl)} alt="Preview da imagem" className="w-full max-h-40 object-cover" />
                                {selectedFile && (
                                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/70 px-2.5 py-1 rounded-lg">
                                        <ImageIcon className="w-3 h-3 text-blue-400" />
                                        <span className="text-[11px] text-blue-300">Será enviada ao salvar</span>
                                    </div>
                                )}
                                <button onClick={handleRemoveImage}
                                    className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-red-600 transition-all">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-6 flex flex-col items-center gap-2 text-slate-500 hover:text-blue-400 transition-all group"
                            >
                                <ImageIcon className="w-8 h-8 group-hover:scale-110 transition-transform" />
                                <span className="text-sm">Clique para adicionar imagem</span>
                            </button>
                        )}
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }} />
                        {previewUrl && (
                            <input value={imageCaption} onChange={e => setImageCaption(e.target.value)}
                                placeholder="Legenda da imagem (opcional)"
                                maxLength={1024}
                                className="mt-2 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        )}
                    </div>

                    {/* Texto */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-medium text-slate-400">Texto da Mensagem</label>
                            <span className={`text-xs font-mono ${charColor}`}>{body.length.toLocaleString("pt-BR")} / {WHATSAPP_CHAR_LIMIT.toLocaleString("pt-BR")}</span>
                        </div>
                        <textarea
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            placeholder={"Olá *{nome}*! Sua consulta está agendada para amanhã às {hora}.\n\n_Confirme presença respondendo SIM._"}
                            rows={6}
                            maxLength={WHATSAPP_CHAR_LIMIT}
                            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none leading-relaxed font-mono"
                        />
                        <div className="w-full h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${charPercentage > 90 ? "bg-red-500" : charPercentage > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                                style={{ width: `${charPercentage}%` }} />
                        </div>
                        <p className="text-[10px] text-slate-600 mt-1">Use *negrito*, _itálico_, ~tachado~ do WhatsApp. Suporta emojis.</p>
                    </div>

                    {/* Preview */}
                    <div>
                        <button onClick={() => setShowPreview(v => !v)}
                            className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors mb-2">
                            <Eye className="w-3.5 h-3.5" />{showPreview ? "Ocultar" : "Ver"} pré-visualização
                        </button>
                        {showPreview && <WhatsAppPreview body={body} imageUrl={previewUrl} imageCaption={imageCaption} />}
                    </div>
                </div>

                <div className="flex gap-3 p-6 border-t border-slate-800">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-all text-sm">Cancelar</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all text-sm disabled:opacity-50">
                        {saving ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {selectedFile ? "Enviando imagem..." : "Salvando..."}
                            </span>
                        ) : (template ? "Salvar Alterações" : "Criar Template")}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Broadcast Wizard ────────────────────────────────────────────────────────

function BroadcastWizard({ templates, onClose, onCreated }: {
    templates: Template[];
    onClose: () => void;
    onCreated: () => void;
}) {
    const [step, setStep] = useState(1);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [selectedPatients, setSelectedPatients] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState("");
    const [loadingPatients, setLoadingPatients] = useState(false);
    const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
    const [scheduleDate, setScheduleDate] = useState("");
    const [scheduleHour, setScheduleHour] = useState("08");
    const [sending, setSending] = useState(false);

    const fetchPatients = useCallback(async (q: string) => {
        setLoadingPatients(true);
        try {
            const params = new URLSearchParams({ limit: "200" });
            if (q) params.set("search", q);
            const res = await fetch(`/api/patients?${params}`);
            if (res.ok) {
                const data = await res.json();
                setPatients(data.patients || []);
            }
        } finally {
            setLoadingPatients(false);
        }
    }, []);

    useEffect(() => {
        if (step === 2) {
            const timer = setTimeout(() => fetchPatients(search), 400);
            return () => clearTimeout(timer);
        }
    }, [search, step, fetchPatients]);

    const togglePatient = (id: string) => {
        setSelectedPatients(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        const withPhone = patients.filter(p => p.telefone_principal).map(p => p.id);
        if (withPhone.every(id => selectedPatients.has(id))) {
            setSelectedPatients(prev => { const n = new Set(prev); withPhone.forEach(id => n.delete(id)); return n; });
        } else {
            setSelectedPatients(prev => { const n = new Set(prev); withPhone.forEach(id => n.add(id)); return n; });
        }
    };

    const handleSend = async () => {
        if (!selectedTemplate || selectedPatients.size === 0) return;
        setSending(true);
        try {
            let scheduled_at: string | null = null;
            if (scheduleMode === "later") {
                if (!scheduleDate) { toast.error("Selecione a data do agendamento"); setSending(false); return; }
                scheduled_at = new Date(`${scheduleDate}T${scheduleHour}:00:00`).toISOString();
            }
            const res = await fetch("/api/broadcasts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    template_id: selectedTemplate.id,
                    patient_ids: Array.from(selectedPatients),
                    scheduled_at,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Erro ao criar disparo");
            }
            toast.success(scheduleMode === "now" ? "Disparo iniciado!" : "Disparo agendado com sucesso!");
            onCreated();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSending(false);
        }
    };

    const filteredPatients = patients.filter(p =>
        p.telefone_principal &&
        (!search || (p.nome || "").toLowerCase().includes(search.toLowerCase()) ||
            (p.cpf || "").includes(search) ||
            (p.telefone_principal || "").includes(search))
    );

    const withPhoneIds = filteredPatients.map(p => p.id);
    const allChecked = withPhoneIds.length > 0 && withPhoneIds.every(id => selectedPatients.has(id));

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <h3 className="text-white font-semibold text-lg">Novo Disparo</h3>
                        <div className="flex gap-1">
                            {[1, 2, 3].map(s => (
                                <div key={s} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${s === step ? "bg-blue-600 border-blue-600 text-white" : s < step ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-700 text-slate-500"}`}>
                                    {s < step ? <Check className="w-3 h-3" /> : s}
                                </div>
                            ))}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {/* STEP 1: Selecionar Template */}
                    {step === 1 && (
                        <div className="space-y-3">
                            <p className="text-sm text-slate-400 mb-4">Selecione o template de mensagem que será enviado:</p>
                            {templates.length === 0 && (
                                <div className="text-center py-8 text-slate-500 text-sm">Nenhum template cadastrado</div>
                            )}
                            {templates.map(t => {
                                const type = t.body && t.image_url ? "Texto + Imagem" : t.image_url ? "Imagem" : "Texto";
                                const typeIcon = t.image_url ? <ImageIcon className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />;
                                return (
                                    <button key={t.id} onClick={() => setSelectedTemplate(t)}
                                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selectedTemplate?.id === t.id ? "border-blue-500 bg-blue-500/10" : "border-slate-800 hover:border-slate-600 bg-slate-800/50"}`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="font-medium text-white text-sm">{t.name}</p>
                                                {t.body && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{t.body}</p>}
                                            </div>
                                            <span className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-700 px-2 py-1 rounded-lg shrink-0">
                                                {typeIcon}{type}
                                            </span>
                                        </div>
                                        {selectedTemplate?.id === t.id && <div className="mt-3 border-t border-blue-500/30 pt-3"><WhatsAppPreview body={t.body || undefined} imageUrl={t.image_url || undefined} imageCaption={t.image_caption || undefined} /></div>}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* STEP 2: Selecionar Pacientes */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-slate-400">Selecione os pacientes destinatários:</p>
                                <span className="text-blue-400 text-sm font-medium">{selectedPatients.size} selecionados</span>
                            </div>
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="Buscar por nome, CPF ou telefone..."
                                    className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>

                            {/* Select All */}
                            {filteredPatients.length > 0 && (
                                <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700 cursor-pointer hover:bg-slate-800">
                                    <input type="checkbox" checked={allChecked} onChange={toggleAll}
                                        className="w-4 h-4 rounded text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500" />
                                    <span className="text-sm text-slate-300 font-medium">Selecionar todos ({filteredPatients.length})</span>
                                </label>
                            )}

                            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                                {loadingPatients ? (
                                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
                                ) : filteredPatients.length === 0 ? (
                                    <p className="text-center text-slate-500 text-sm py-6">Nenhum paciente com telefone cadastrado</p>
                                ) : filteredPatients.map(p => (
                                    <label key={p.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selectedPatients.has(p.id) ? "bg-blue-500/10 border border-blue-500/30" : "bg-slate-800/50 border border-slate-800 hover:bg-slate-800"}`}>
                                        <input type="checkbox" checked={selectedPatients.has(p.id)} onChange={() => togglePatient(p.id)}
                                            className="w-4 h-4 rounded text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500" />
                                        <div className="min-w-0">
                                            <p className="text-sm text-white font-medium truncate">{p.nome || "Sem nome"}</p>
                                            <p className="text-xs text-slate-400">{p.telefone_principal}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Agendar ou enviar agora */}
                    {step === 3 && (
                        <div className="space-y-5">
                            <div>
                                <p className="text-sm text-slate-400 mb-4">Escolha quando deseja enviar as mensagens:</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => setScheduleMode("now")}
                                        className={`p-4 rounded-xl border-2 text-left transition-all ${scheduleMode === "now" ? "border-emerald-500 bg-emerald-500/10" : "border-slate-700 hover:border-slate-600"}`}>
                                        <Zap className={`w-6 h-6 mb-2 ${scheduleMode === "now" ? "text-emerald-400" : "text-slate-400"}`} />
                                        <p className={`font-medium text-sm ${scheduleMode === "now" ? "text-emerald-400" : "text-white"}`}>Enviar Agora</p>
                                        <p className="text-xs text-slate-500 mt-1">Disparo imediato via N8N</p>
                                    </button>
                                    <button onClick={() => setScheduleMode("later")}
                                        className={`p-4 rounded-xl border-2 text-left transition-all ${scheduleMode === "later" ? "border-blue-500 bg-blue-500/10" : "border-slate-700 hover:border-slate-600"}`}>
                                        <Calendar className={`w-6 h-6 mb-2 ${scheduleMode === "later" ? "text-blue-400" : "text-slate-400"}`} />
                                        <p className={`font-medium text-sm ${scheduleMode === "later" ? "text-blue-400" : "text-white"}`}>Agendar</p>
                                        <p className="text-xs text-slate-500 mt-1">Escolha data e horário</p>
                                    </button>
                                </div>
                            </div>

                            {scheduleMode === "later" && (
                                <div className="space-y-3 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                                    <div>
                                        <label className="text-xs font-medium text-slate-400 mb-1.5 block">Data do Disparo</label>
                                        <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                                            min={new Date().toISOString().split("T")[0]}
                                            className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-400 mb-1.5 block">Horário</label>
                                        <select value={scheduleHour} onChange={e => setScheduleHour(e.target.value)}
                                            className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                                            {SCHEDULE_HOURS.map(h => (
                                                <option key={h} value={String(h).padStart(2, "0")}>{String(h).padStart(2, "0")}:00</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 space-y-2">
                                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Resumo do Disparo</p>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-400">Template:</span>
                                    <span className="text-white font-medium">{selectedTemplate?.name}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-400">Destinatários:</span>
                                    <span className="text-white font-medium">{selectedPatients.size} pacientes</span>
                                </div>
                                {scheduleMode === "later" && scheduleDate && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-400">Agendado para:</span>
                                        <span className="text-blue-400 font-medium">{scheduleDate} às {scheduleHour}:00</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-6 border-t border-slate-800">
                    {step > 1 && (
                        <button onClick={() => setStep(s => s - 1)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-all text-sm">
                            <ChevronLeft className="w-4 h-4" />Voltar
                        </button>
                    )}
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-all text-sm">
                        Cancelar
                    </button>
                    {step < 3 ? (
                        <button
                            disabled={(step === 1 && !selectedTemplate) || (step === 2 && selectedPatients.size === 0)}
                            onClick={() => {
                                if (step === 1 && selectedTemplate) { setStep(2); fetchPatients(""); }
                                else if (step === 2 && selectedPatients.size > 0) setStep(3);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all text-sm disabled:opacity-50">
                            Próximo<ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button onClick={handleSend} disabled={sending}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-all text-sm disabled:opacity-50">
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {sending ? "Enviando..." : scheduleMode === "now" ? "Disparar Agora" : "Agendar Disparo"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Broadcast Detail Modal ──────────────────────────────────────────────────

function BroadcastDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
    const [broadcast, setBroadcast] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/broadcasts/${id}`);
                if (res.ok) {
                    const data = await res.json();
                    setBroadcast(data.broadcast);
                }
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [id]);

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <div>
                        <h3 className="text-white font-semibold text-lg">Detalhes do Disparo</h3>
                        <p className="text-xs text-slate-500">ID: #{id}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
                    ) : !broadcast ? (
                        <p className="text-center py-10 text-slate-500">Erro ao carregar detalhes</p>
                    ) : (
                        <div className="space-y-6">
                            {/* Resumo */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-800">
                                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Status</p>
                                    <StatusBadge status={broadcast.status} />
                                </div>
                                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-800">
                                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Enviados</p>
                                    <p className="text-lg font-bold text-emerald-400">{broadcast.sent_count} / {broadcast.total_recipients}</p>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-800">
                                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Falhas</p>
                                    <p className="text-lg font-bold text-red-400">{broadcast.failed_count}</p>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-800">
                                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Template</p>
                                    <p className="text-sm font-semibold text-white truncate">{broadcast.template?.name}</p>
                                </div>
                            </div>

                            {/* Tabela de Destinatários */}
                            <div>
                                <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                                    <Users className="w-4 h-4" /> Lista de Destinatários
                                </h4>
                                <div className="bg-slate-950/50 rounded-xl border border-slate-800 overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-slate-800/50 text-slate-500">
                                            <tr>
                                                <th className="px-4 py-2 text-left font-medium">Paciente</th>
                                                <th className="px-4 py-2 text-left font-medium">Telefone</th>
                                                <th className="px-4 py-2 text-left font-medium">Status</th>
                                                <th className="px-4 py-2 text-left font-medium">Erro</th>
                                                <th className="px-4 py-2 text-left font-medium">Enviado em</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {broadcast.recipients?.map((r: any) => (
                                                <tr key={r.id} className="hover:bg-slate-800/20">
                                                    <td className="px-4 py-2 font-medium text-slate-200">{r.name || "—"}</td>
                                                    <td className="px-4 py-2 text-slate-400">{r.phone}</td>
                                                    <td className="px-4 py-2">
                                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium 
                                                            ${r.status === "sent" ? "bg-emerald-500/10 text-emerald-400" : 
                                                              r.status === "failed" ? "bg-red-500/10 text-red-500" : "bg-slate-500/10 text-slate-400"}`}>
                                                            {r.status === "sent" ? "Enviado" : r.status === "failed" ? "Falha" : "Pendente"}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2 text-red-400/80 max-w-xs truncate" title={r.error}>
                                                        {r.error || "—"}
                                                    </td>
                                                    <td className="px-4 py-2 text-slate-500">{formatDate(r.sent_at)}</td>
                                                </tr>
                                            ))}
                                            {(!broadcast.recipients || broadcast.recipients.length === 0) && (
                                                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-600">Nenhum destinatário encontrado</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function BroadcastsPage() {
    const [tab, setTab] = useState<"templates" | "broadcasts">("templates");
    const [templates, setTemplates] = useState<Template[]>([]);
    const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const [loadingBroadcasts, setLoadingBroadcasts] = useState(true);
    const [templateSearch, setTemplateSearch] = useState("");
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const [showWizard, setShowWizard] = useState(false);
    const [viewingBroadcastId, setViewingBroadcastId] = useState<string | null>(null);

    // Filtros de Data
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const fetchTemplates = useCallback(async () => {
        setLoadingTemplates(true);
        try {
            const params = templateSearch ? `?search=${encodeURIComponent(templateSearch)}` : "";
            const res = await fetch(`/api/message-templates${params}`);
            if (res.ok) { const d = await res.json(); setTemplates(d.templates || []); }
        } finally { setLoadingTemplates(false); }
    }, [templateSearch]);

    const fetchBroadcasts = useCallback(async (silent = false) => {
        if (!silent) setLoadingBroadcasts(true);
        try {
            const params = new URLSearchParams();
            if (startDate) params.append("startDate", startDate);
            if (endDate) params.append("endDate", endDate);

            const res = await fetch(`/api/broadcasts?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setBroadcasts(data.broadcasts || []);
            }
        } finally {
            if (!silent) setLoadingBroadcasts(false);
        }
    }, [startDate, endDate]);

    // Polling: enquanto houver broadcasts em 'processing', recarrega a cada 5s
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    useEffect(() => {
        const hasProcessing = broadcasts.some(b => b.status === "processing");
        if (hasProcessing) {
            pollingRef.current = setTimeout(() => fetchBroadcasts(true), 5000);
        } else {
            if (pollingRef.current) clearTimeout(pollingRef.current);
        }
        return () => { if (pollingRef.current) clearTimeout(pollingRef.current); };
    }, [broadcasts, fetchBroadcasts]);

    useEffect(() => { const t = setTimeout(fetchTemplates, 300); return () => clearTimeout(t); }, [fetchTemplates]);
    useEffect(() => { fetchBroadcasts(); }, [fetchBroadcasts, startDate, endDate]);

    const handleDeleteTemplate = async (t: Template) => {
        if (!confirm(`Deseja excluir o template "${t.name}"?`)) return;
        const res = await fetch(`/api/message-templates/${t.id}`, { method: "DELETE" });
        if (res.ok) { toast.success("Template excluído"); fetchTemplates(); }
        else toast.error("Erro ao excluir");
    };

    const handleCancelBroadcast = async (b: Broadcast) => {
        if (!confirm("Cancelar este disparo agendado?")) return;
        const res = await fetch(`/api/broadcasts/${b.id}`, { method: "DELETE" });
        if (res.ok) { toast.success("Disparo cancelado"); fetchBroadcasts(); }
        else toast.error("Erro ao cancelar");
    };

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto h-full">
            {/* Header */}
            <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center shrink-0">
                            <Send className="w-5 h-5 text-white" />
                        </div>
                        Disparo de Mensagens
                    </h1>
                    <p className="text-slate-400 text-sm mt-1 ml-12">Gerencie templates e dispare mensagens para seus pacientes via WhatsApp.</p>
                </div>
                <div className="flex gap-3 flex-wrap">
                    {tab === "templates" && (
                        <button onClick={() => { setEditingTemplate(null); setShowTemplateModal(true); }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-medium hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg shadow-blue-500/20">
                            <Plus className="w-4 h-4" />Novo Template
                        </button>
                    )}
                    {tab === "broadcasts" && (
                        <button onClick={() => setShowWizard(true)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 text-white text-sm font-medium hover:from-violet-500 hover:to-purple-400 transition-all shadow-lg shadow-violet-500/20">
                            <Send className="w-4 h-4" />Novo Disparo
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit mb-6">
                <button onClick={() => setTab("templates")}
                    className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === "templates" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"}`}>
                    <FileText className="w-4 h-4" />Templates
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === "templates" ? "bg-blue-500/50" : "bg-slate-800"}`}>{templates.length}</span>
                </button>
                <button onClick={() => setTab("broadcasts")}
                    className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === "broadcasts" ? "bg-violet-600 text-white shadow" : "text-slate-400 hover:text-white"}`}>
                    <Send className="w-4 h-4" />Disparos
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === "broadcasts" ? "bg-violet-500/50" : "bg-slate-800"}`}>{broadcasts.length}</span>
                </button>
            </div>

            {/* ── ABA TEMPLATES ── */}
            {tab === "templates" && (
                <div className="space-y-4">
                    {/* Search */}
                    <div className="relative w-full max-w-md">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input value={templateSearch} onChange={e => setTemplateSearch(e.target.value)}
                            placeholder="Buscar template..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    {loadingTemplates ? (
                        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
                    ) : templates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mb-4">
                                <FileText className="w-8 h-8 text-slate-600" />
                            </div>
                            <p className="text-slate-400 font-medium">Nenhum template cadastrado</p>
                            <p className="text-slate-600 text-sm mt-1">Crie seu primeiro template para começar a disparar mensagens</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {templates.map(t => {
                                const hasText = !!t.body;
                                const hasImage = !!t.image_url;
                                return (
                                    <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-600 transition-all group">
                                        {t.image_url && (
                                            <div className="h-32 bg-slate-800 overflow-hidden">
                                                <img src={getProxiedImageUrl(t.image_url)} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                            </div>
                                        )}
                                        <div className="p-4">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <h3 className="font-semibold text-white text-sm leading-tight">{t.name}</h3>
                                                <div className="flex gap-1 shrink-0">
                                                    {hasText && <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">Texto</span>}
                                                    {hasImage && <span className="text-[10px] bg-violet-500/10 text-violet-400 px-1.5 py-0.5 rounded border border-violet-500/20">Imagem</span>}
                                                </div>
                                            </div>
                                            {t.body && <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{t.body}</p>}
                                            {t.image_caption && !t.body && <p className="text-xs text-slate-400 italic">{t.image_caption}</p>}
                                            <p className="text-[10px] text-slate-600 mt-2">{formatDate(t.created_at)}</p>
                                            <div className="flex gap-2 mt-3">
                                                <button onClick={() => { setEditingTemplate(t); setShowTemplateModal(true); }}
                                                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition-all">
                                                    <Pencil className="w-3 h-3" />Editar
                                                </button>
                                                <button onClick={() => handleDeleteTemplate(t)}
                                                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-red-600/20 text-slate-400 hover:text-red-400 text-xs transition-all">
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── ABA DISPAROS ── */}
            {tab === "broadcasts" && (
                <div className="space-y-4">
                    {/* Filtros de Data */}
                    <div className="flex flex-wrap items-end gap-3 bg-slate-900/50 p-4 border border-slate-800 rounded-2xl">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <CalendarDays className="w-3 h-3" /> Data Inicial
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <CalendarDays className="w-3 h-3" /> Data Final
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
                            />
                        </div>
                        <button
                            onClick={() => { setStartDate(""); setEndDate(""); }}
                            disabled={!startDate && !endDate}
                            className="h-10 px-4 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-all text-sm disabled:opacity-30 flex items-center gap-2"
                        >
                            <X className="w-4 h-4" /> Limpar
                        </button>
                    </div>

                    {loadingBroadcasts ? (
                        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-violet-500 animate-spin" /></div>
                    ) : broadcasts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mb-4">
                                <Send className="w-8 h-8 text-slate-600" />
                            </div>
                            <p className="text-slate-400 font-medium">Nenhum disparo realizado</p>
                            <p className="text-slate-600 text-sm mt-1">Clique em "Novo Disparo" para enviar mensagens aos seus pacientes</p>
                        </div>
                    ) : (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-800/50 text-xs uppercase text-slate-500 sticky top-0">
                                        <tr>
                                            <th className="px-5 py-3.5 text-left font-medium">Template</th>
                                            <th className="px-5 py-3.5 text-left font-medium">Status</th>
                                            <th className="px-5 py-3.5 text-center font-medium">Destinatários</th>
                                            <th className="px-5 py-3.5 text-center font-medium">Enviados</th>
                                            <th className="px-5 py-3.5 text-center font-medium">Falhas</th>
                                            <th className="px-5 py-3.5 text-left font-medium">Agendado para</th>
                                            <th className="px-5 py-3.5 text-left font-medium">Criado em</th>
                                            <th className="px-5 py-3.5" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {broadcasts.map(b => (
                                            <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="px-5 py-3.5">
                                                    <span className="font-medium text-white">{b.template?.name || "—"}</span>
                                                </td>
                                                <td className="px-5 py-3.5"><StatusBadge status={b.status} /></td>
                                                <td className="px-5 py-3.5 text-center">
                                                    <span className="text-slate-300 font-medium">{b.total_recipients}</span>
                                                </td>
                                                <td className="px-5 py-3.5 text-center">
                                                    <span className="text-emerald-400 font-medium">{b.sent_count}</span>
                                                </td>
                                                <td className="px-5 py-3.5 text-center">
                                                    <span className={b.failed_count > 0 ? "text-red-400 font-medium" : "text-slate-600"}>{b.failed_count}</span>
                                                </td>
                                                <td className="px-5 py-3.5 text-slate-400 text-xs">
                                                    {b.scheduled_at ? formatDate(b.scheduled_at) : <span className="text-emerald-400">Imediato</span>}
                                                </td>
                                                <td className="px-5 py-3.5 text-slate-500 text-xs">{formatDate(b.created_at)}</td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-2 justify-end">
                                                        <button onClick={() => setViewingBroadcastId(b.id)}
                                                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all shadow-sm"
                                                            title="Ver detalhes e falhas">
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        {b.status === "scheduled" && (
                                                            <button onClick={() => handleCancelBroadcast(b)}
                                                                className="p-2 rounded-lg bg-slate-800 hover:bg-red-600/20 text-slate-400 hover:text-red-400 transition-all shadow-sm"
                                                                title="Cancelar agendamento">
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modais */}
            {showTemplateModal && (
                <TemplateModal
                    template={editingTemplate}
                    onClose={() => { setShowTemplateModal(false); setEditingTemplate(null); }}
                    onSave={() => { setShowTemplateModal(false); setEditingTemplate(null); fetchTemplates(); }}
                />
            )}
            {showWizard && (
                <BroadcastWizard
                    templates={templates}
                    onClose={() => setShowWizard(false)}
                    onCreated={() => { setShowWizard(false); setTab("broadcasts"); fetchBroadcasts(); }}
                />
            )}
            {viewingBroadcastId && (
                <BroadcastDetailModal
                    id={viewingBroadcastId}
                    onClose={() => setViewingBroadcastId(null)}
                />
            )}
        </div>
    );
}
