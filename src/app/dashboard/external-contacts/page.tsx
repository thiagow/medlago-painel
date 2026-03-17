"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Phone, Plus, Pencil, Trash2, Search, X
} from "lucide-react";
import toast from "react-hot-toast";

interface ExternalContact {
    id: string;
    name: string;
    phone: string;
    description: string | null;
    active: boolean | null;
    created_at: string | null;
}

function formatPhone(phone: string) {
    return phone.replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, "+$1 ($2) $3-$4");
}

export default function ExternalContactsPage() {
    const [contacts, setContacts] = useState<ExternalContact[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<ExternalContact | null>(null);
    const [formName, setFormName] = useState("");
    const [formPhone, setFormPhone] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [saving, setSaving] = useState(false);

    const fetchContacts = useCallback(async () => {
        try {
            const res = await fetch("/api/external-contacts");
            if (res.ok) {
                const data = await res.json();
                setContacts(data.externalContacts || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchContacts(); }, [fetchContacts]);

    const openCreate = () => {
        setEditing(null);
        setFormName(""); setFormPhone(""); setFormDescription("");
        setShowModal(true);
    };

    const openEdit = (c: ExternalContact) => {
        setEditing(c);
        setFormName(c.name);
        setFormPhone(c.phone);
        setFormDescription(c.description || "");
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formName.trim() || !formPhone.trim()) {
            toast.error("Nome e telefone são obrigatórios"); return;
        }
        setSaving(true);
        try {
            const url = editing ? `/api/external-contacts/${editing.id}` : "/api/external-contacts";
            const method = editing ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formName.trim(),
                    phone: formPhone.trim(),
                    description: formDescription.trim() || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) { toast.error(data.error || "Erro ao salvar"); return; }
            toast.success(editing ? "Contato atualizado!" : "Contato criado!");
            setShowModal(false);
            fetchContacts();
        } catch {
            toast.error("Erro de rede");
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = async (c: ExternalContact) => {
        if (!confirm(`Desativar o contato "${c.name}"?`)) return;
        try {
            const res = await fetch(`/api/external-contacts/${c.id}`, { method: "DELETE" });
            if (res.ok) { toast.success("Contato desativado"); fetchContacts(); }
            else { toast.error("Erro ao desativar"); }
        } catch { toast.error("Erro de rede"); }
    };

    const filtered = contacts.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search)
    );

    return (
        <div className="flex flex-col h-full bg-slate-950 p-6 md:p-8 max-w-5xl mx-auto w-full">
            {/* Cabeçalho */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                            <Phone className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Contatos Externos</h1>
                            <p className="text-slate-400 text-sm">Números para transferência de atendimento</p>
                        </div>
                    </div>
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Novo Contato
                    </button>
                </div>
            </div>

            {/* Busca */}
            <div className="relative mb-6">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                    type="text"
                    placeholder="Buscar por nome ou número..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
            </div>

            {/* Tabela */}
            {loading ? (
                <div className="flex items-center justify-center h-40">
                    <span className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                    <Phone className="w-10 h-10 text-slate-700 mb-3" />
                    <p className="text-slate-400">Nenhum contato externo cadastrado</p>
                    <button onClick={openCreate} className="mt-3 text-emerald-400 text-sm hover:underline">
                        Adicionar primeiro contato
                    </button>
                </div>
            ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-800 text-left">
                                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Nome</th>
                                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">WhatsApp</th>
                                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Descrição</th>
                                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider w-20">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {filtered.map((c) => (
                                <tr key={c.id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                                                <span className="text-xs font-bold text-emerald-400">
                                                    {c.name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <span className="text-sm font-medium text-white">{c.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-sm text-slate-300 font-mono">{formatPhone(c.phone)}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-sm text-slate-400">{c.description || "—"}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => openEdit(c)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDeactivate(c)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-white font-semibold text-lg">
                                {editing ? "Editar Contato" : "Novo Contato Externo"}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="text-xs font-medium text-slate-400 block mb-1.5">Nome *</label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="Ex: Equipe de Suporte"
                                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-400 block mb-1.5">WhatsApp * <span className="text-slate-500">(somente números, com DDI)</span></label>
                                <input
                                    type="text"
                                    value={formPhone}
                                    onChange={(e) => setFormPhone(e.target.value)}
                                    placeholder="5511999999999"
                                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-400 block mb-1.5">Descrição</label>
                                <textarea
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    placeholder="Descrição opcional..."
                                    rows={2}
                                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 transition-all text-sm">
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium transition-all text-sm"
                            >
                                {saving ? "Salvando..." : editing ? "Salvar" : "Criar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
