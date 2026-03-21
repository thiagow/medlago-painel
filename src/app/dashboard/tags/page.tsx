"use client";

import { useState, useEffect, useCallback } from "react";
import { Tag, Plus, Pencil, Trash2, Search, X, Check } from "lucide-react";
import toast from "react-hot-toast";

interface TagData {
    id: string;
    name: string;
    color: string;
    active: boolean | null;
    created_at: string | null;
}

const PREDEFINED_COLORS = [
    "#6366f1", // Indigo
    "#3b82f6", // Blue
    "#06b6d4", // Cyan
    "#14b8a6", // Teal
    "#10b981", // Emerald
    "#22c55e", // Green
    "#84cc16", // Lime
    "#eab308", // Yellow
    "#f97316", // Orange
    "#ef4444", // Red
    "#ec4899", // Pink
    "#f43f5e", // Rose
    "#a855f7", // Purple
    "#8b5cf6", // Violet
    "#64748b", // Slate
    "#334155"  // Slate Dark
];

export default function TagsPage() {
    const [tags, setTags] = useState<TagData[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    // Modal de criar/editar
    const [showModal, setShowModal] = useState(false);
    const [editingTag, setEditingTag] = useState<TagData | null>(null);
    const [formName, setFormName] = useState("");
    const [formColor, setFormColor] = useState(PREDEFINED_COLORS[0]);
    const [saving, setSaving] = useState(false);

    const fetchTags = useCallback(async () => {
        try {
            const res = await fetch("/api/tags");
            if (res.ok) {
                const data = await res.json();
                setTags(data.tags || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTags();
    }, [fetchTags]);

    const openCreate = () => {
        setEditingTag(null);
        setFormName("");
        setFormColor(PREDEFINED_COLORS[0]);
        setShowModal(true);
    };

    const openEdit = (tag: TagData) => {
        setEditingTag(tag);
        setFormName(tag.name);
        setFormColor(tag.color || PREDEFINED_COLORS[0]);
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formName.trim()) { toast.error("Nome é obrigatório"); return; }
        setSaving(true);
        try {
            const url = editingTag ? `/api/tags/${editingTag.id}` : "/api/tags";
            const method = editingTag ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: formName.trim(), color: formColor }),
            });
            const data = await res.json();
            if (!res.ok) { toast.error(data.error || "Erro ao salvar"); return; }
            toast.success(editingTag ? "Tag atualizada!" : "Tag criada!");
            setShowModal(false);
            fetchTags();
        } catch {
            toast.error("Erro de rede");
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = async (tag: TagData) => {
        if (!confirm(`Desativar a tag "${tag.name}"?`)) return;
        try {
            const res = await fetch(`/api/tags/${tag.id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Tag desativada");
                fetchTags();
            } else {
                toast.error("Erro ao desativar");
            }
        } catch {
            toast.error("Erro de rede");
        }
    };

    const filtered = tags.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-slate-950 p-6 md:p-8 max-w-5xl mx-auto w-full">
            {/* Cabeçalho */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                            <Tag className="w-5 h-5 text-violet-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Tags</h1>
                            <p className="text-slate-400 text-sm">Gerencie as etiquetas para categorizar atendimentos</p>
                        </div>
                    </div>
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Nova Tag
                    </button>
                </div>
            </div>

            {/* Busca */}
            <div className="relative mb-6">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                    type="text"
                    placeholder="Buscar tag..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
            </div>

            {/* Lista */}
            {loading ? (
                <div className="flex items-center justify-center h-40">
                    <span className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center border border-dashed border-slate-800 rounded-2xl">
                    <Tag className="w-10 h-10 text-slate-700 mb-3" />
                    <p className="text-slate-400">Nenhuma tag encontrada</p>
                    <button onClick={openCreate} className="mt-3 text-violet-400 text-sm hover:underline">
                        Criar a primeira tag
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((tag) => (
                        <div key={tag.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between group hover:border-slate-700 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                                <div 
                                    className="w-4 h-4 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: tag.color || "#6366f1" }}
                                />
                                <div className="min-w-0">
                                    <p className="font-semibold text-white text-sm truncate">{tag.name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button
                                    onClick={() => openEdit(tag)}
                                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                                    title="Editar"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDeactivate(tag)}
                                    className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                    title="Desativar"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Criar/Editar */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                                <Tag className="w-5 h-5 text-violet-400" />
                                {editingTag ? "Editar Tag" : "Nova Tag"}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-5 mb-6">
                            <div>
                                <label className="text-xs font-medium text-slate-400 block mb-1.5">Noma da Tag *</label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="Ex: Urgente, Agendamento..."
                                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                                />
                            </div>
                            
                            <div>
                                <label className="text-xs font-medium text-slate-400 block mb-3">Cor da Tag</label>
                                <div className="grid grid-cols-8 gap-2">
                                    {PREDEFINED_COLORS.map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => setFormColor(color)}
                                            className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none"
                                            style={{ backgroundColor: color }}
                                            type="button"
                                            title={color}
                                        >
                                            {formColor === color && (
                                                <Check className="w-4 h-4 text-white drop-shadow-md" strokeWidth={3} />
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-4 p-3 bg-slate-900/50 rounded-xl flex items-center gap-3 border border-slate-800/50">
                                    <span className="text-xs text-slate-400">Preview:</span>
                                    <span 
                                        className="px-2.5 py-1 rounded-full text-xs font-medium border text-white"
                                        style={{ 
                                            backgroundColor: `${formColor}20`, 
                                            borderColor: `${formColor}40`,
                                            color: formColor
                                        }}
                                    >
                                        {formName || "Nome da Tag"}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 transition-all text-sm font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium transition-all text-sm"
                            >
                                {saving ? "Salvando..." : editingTag ? "Salvar" : "Criar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
