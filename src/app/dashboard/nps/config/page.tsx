"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
    Settings,
    Save,
    RotateCcw,
    ToggleLeft,
    ToggleRight,
    MessageSquare,
    ChevronRight,
} from "lucide-react";

const DEFAULTS: Record<string, string> = {
    enabled:          "true",
    greeting:         "Olá! Seu atendimento com *{agent_name}* foi finalizado. Gostaríamos de saber como foi sua experiência!",
    question:         "De 0 a 10, como você avalia o atendimento?",
    button_bad:       "😞 0 a 3",
    button_neutral:   "😐 4 a 7",
    button_good:      "😍 8 a 10",
    followup_bad:     "Sentimos muito. O que poderíamos ter feito para melhorar?",
    followup_neutral: "O que poderíamos ter feito diferente?",
    followup_good:    "Que bom! O que você mais gostou no atendimento?",
    thank_you:        "Obrigado pela sua avaliação! Ela é muito importante para nós. ✨",
};

const FIELDS = [
    { key: "greeting",         label: "Mensagem de Saudação",         hint: "Use {agent_name} para o nome do atendente.", rows: 3 },
    { key: "question",         label: "Pergunta Principal",            hint: "Exibida junto com os botões de avaliação.", rows: 2 },
    { key: "button_bad",       label: 'Botão "Ruim" (0 a 3)',         hint: "Texto do botão de avaliação negativa.", rows: 1 },
    { key: "button_neutral",   label: 'Botão "Regular" (4 a 7)',      hint: "Texto do botão de avaliação neutra.", rows: 1 },
    { key: "button_good",      label: 'Botão "Ótimo" (8 a 10)',       hint: "Texto do botão de avaliação positiva.", rows: 1 },
    { key: "followup_bad",     label: "Followup — Avaliação Ruim",    hint: "Enviado após clicar no botão de avaliação negativa.", rows: 2 },
    { key: "followup_neutral", label: "Followup — Avaliação Regular", hint: "Enviado após clicar no botão de avaliação neutra.", rows: 2 },
    { key: "followup_good",    label: "Followup — Avaliação Ótima",   hint: "Enviado após clicar no botão de avaliação positiva.", rows: 2 },
    { key: "thank_you",        label: "Mensagem de Agradecimento",     hint: "Enviada ao finalizar a pesquisa.", rows: 2 },
];

export default function NpsConfigPage() {
    const { user, isAdmin, loading: authLoading } = useAuth();
    const router = useRouter();

    const [config, setConfig] = useState<Record<string, string>>({ ...DEFAULTS });
    const [loading, setLoading] = useState(true);
    const [saving,  setSaving]  = useState(false);

    useEffect(() => {
        if (!authLoading && user && !isAdmin()) {
            router.push("/dashboard");
        }
    }, [user, isAdmin, authLoading, router]);

    const fetchConfig = useCallback(async () => {
        if (!isAdmin()) return;
        try {
            const res = await fetch("/api/nps/config");
            if (!res.ok) return;
            const data = await res.json();
            setConfig(prev => ({ ...prev, ...data.config }));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchConfig(); }, [fetchConfig]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/nps/config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            if (!res.ok) throw new Error();
            toast.success("Configurações salvas com sucesso!");
        } catch {
            toast.error("Erro ao salvar configurações.");
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setConfig({ ...DEFAULTS });
        toast("Textos restaurados para o padrão.", { icon: "🔄" });
    };

    const toggleEnabled = () => {
        setConfig(prev => ({ ...prev, enabled: prev.enabled === "true" ? "false" : "true" }));
    };

    const isEnabled = config.enabled === "true";

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                    <h1 className="text-xl font-semibold text-white">Configuração do NPS</h1>
                    <p className="text-sm text-slate-400">Personalize os textos da pesquisa de satisfação pós-atendimento.</p>
                </div>
            </div>

            {/* Toggle NPS */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 mb-6 flex items-center justify-between">
                <div>
                    <p className="text-white font-medium">Pesquisa de Satisfação (NPS)</p>
                    <p className="text-slate-400 text-sm mt-0.5">
                        Quando ativado, ao finalizar um atendimento o paciente receberá a pesquisa via WhatsApp.
                    </p>
                </div>
                <button
                    onClick={toggleEnabled}
                    className="flex items-center gap-2 transition-opacity hover:opacity-80"
                >
                    {isEnabled
                        ? <ToggleRight className="w-10 h-10 text-amber-400" />
                        : <ToggleLeft  className="w-10 h-10 text-slate-500" />
                    }
                    <span className={`text-sm font-medium ${isEnabled ? "text-amber-400" : "text-slate-500"}`}>
                        {isEnabled ? "Ativado" : "Desativado"}
                    </span>
                </button>
            </div>

            {/* Campos de texto */}
            {isEnabled && (
                <div className="space-y-5">
                    {/* Preview visual do fluxo */}
                    <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-4 mb-2">
                        <div className="flex items-center gap-2 mb-3">
                            <MessageSquare className="w-4 h-4 text-slate-400" />
                            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Fluxo da Pesquisa</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                            <span className="bg-amber-500/20 text-amber-300 px-2 py-1 rounded-lg">Saudação</span>
                            <ChevronRight className="w-3 h-3 text-slate-600" />
                            <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-lg">Pergunta + Botões</span>
                            <ChevronRight className="w-3 h-3 text-slate-600" />
                            <span className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded-lg">Followup Condicional</span>
                            <ChevronRight className="w-3 h-3 text-slate-600" />
                            <span className="bg-green-500/20 text-green-300 px-2 py-1 rounded-lg">Agradecimento</span>
                        </div>
                    </div>

                    {FIELDS.map(field => (
                        <div key={field.key} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5">
                            <label className="block text-sm font-medium text-white mb-1">
                                {field.label}
                            </label>
                            {field.hint && (
                                <p className="text-xs text-slate-500 mb-2">{field.hint}</p>
                            )}
                            {field.rows === 1 ? (
                                <input
                                    type="text"
                                    value={config[field.key] || ""}
                                    onChange={e => setConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white
                                               focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-600"
                                />
                            ) : (
                                <textarea
                                    rows={field.rows}
                                    value={config[field.key] || ""}
                                    onChange={e => setConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white resize-none
                                               focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-600"
                                />
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Ações */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-700">
                <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                    <RotateCcw className="w-4 h-4" />
                    Restaurar Padrão
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60
                               text-slate-900 font-semibold text-sm rounded-xl transition-colors"
                >
                    <Save className="w-4 h-4" />
                    {saving ? "Salvando..." : "Salvar Configurações"}
                </button>
            </div>
        </div>
    );
}
