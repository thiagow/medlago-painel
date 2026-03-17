"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Building2, Plus, Pencil, Trash2, Users, Search,
    X, Check, ChevronDown, ChevronUp, UserPlus, AlertCircle
} from "lucide-react";
import toast from "react-hot-toast";

interface Department {
    id: string;
    name: string;
    description: string | null;
    active: boolean | null;
    created_at: string | null;
    users: DeptUser[];
}

interface DeptUser {
    id: string;
    name: string;
    email: string;
    role: string;
    active: boolean | null;
}

interface UserOption {
    id: string;
    name: string;
    email: string;
    role: string;
}

export default function DepartmentsPage() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [allUsers, setAllUsers] = useState<UserOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [expandedDept, setExpandedDept] = useState<string | null>(null);

    // Modal de criar/editar
    const [showModal, setShowModal] = useState(false);
    const [editingDept, setEditingDept] = useState<Department | null>(null);
    const [formName, setFormName] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [saving, setSaving] = useState(false);

    // Modal de adicionar atendente
    const [showAddUser, setShowAddUser] = useState<string | null>(null); // dept id
    const [selectedUserId, setSelectedUserId] = useState("");
    const [addingUser, setAddingUser] = useState(false);

    const fetchDepartments = useCallback(async () => {
        try {
            const res = await fetch("/api/departments");
            if (res.ok) {
                const data = await res.json();
                setDepartments(data.departments || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchUsers = useCallback(async () => {
        try {
            const res = await fetch("/api/users");
            if (res.ok) {
                const data = await res.json();
                setAllUsers(data.users || []);
            }
        } catch (err) {
            console.error(err);
        }
    }, []);

    useEffect(() => {
        fetchDepartments();
        fetchUsers();
    }, [fetchDepartments, fetchUsers]);

    const openCreate = () => {
        setEditingDept(null);
        setFormName("");
        setFormDescription("");
        setShowModal(true);
    };

    const openEdit = (dept: Department) => {
        setEditingDept(dept);
        setFormName(dept.name);
        setFormDescription(dept.description || "");
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formName.trim()) { toast.error("Nome é obrigatório"); return; }
        setSaving(true);
        try {
            const url = editingDept ? `/api/departments/${editingDept.id}` : "/api/departments";
            const method = editingDept ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: formName.trim(), description: formDescription.trim() || null }),
            });
            const data = await res.json();
            if (!res.ok) { toast.error(data.error || "Erro ao salvar"); return; }
            toast.success(editingDept ? "Departamento atualizado!" : "Departamento criado!");
            setShowModal(false);
            fetchDepartments();
        } catch {
            toast.error("Erro de rede");
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = async (dept: Department) => {
        if (!confirm(`Desativar o departamento "${dept.name}"?`)) return;
        try {
            const res = await fetch(`/api/departments/${dept.id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Departamento desativado");
                fetchDepartments();
            } else {
                toast.error("Erro ao desativar");
            }
        } catch {
            toast.error("Erro de rede");
        }
    };

    const handleAddUser = async (deptId: string) => {
        if (!selectedUserId) { toast.error("Selecione um atendente"); return; }
        setAddingUser(true);
        try {
            const res = await fetch(`/api/departments/${deptId}/users`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: selectedUserId }),
            });
            const data = await res.json();
            if (!res.ok) { toast.error(data.error || "Erro ao vincular"); return; }
            toast.success("Atendente vinculado!");
            setShowAddUser(null);
            setSelectedUserId("");
            fetchDepartments();
        } catch {
            toast.error("Erro de rede");
        } finally {
            setAddingUser(false);
        }
    };

    const handleRemoveUser = async (deptId: string, userId: string) => {
        if (!confirm("Desvincular este atendente?")) return;
        try {
            const res = await fetch(`/api/departments/${deptId}/users`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId }),
            });
            if (res.ok) {
                toast.success("Atendente desvinculado");
                fetchDepartments();
            } else {
                toast.error("Erro ao desvincular");
            }
        } catch {
            toast.error("Erro de rede");
        }
    };

    const filtered = departments.filter((d) =>
        d.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-slate-950 p-6 md:p-8 max-w-5xl mx-auto w-full">
            {/* Cabeçalho */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-violet-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Departamentos</h1>
                            <p className="text-slate-400 text-sm">Gerencie departamentos e seus atendentes</p>
                        </div>
                    </div>
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Novo Departamento
                    </button>
                </div>
            </div>

            {/* Busca */}
            <div className="relative mb-6">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                    type="text"
                    placeholder="Buscar departamento..."
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
                <div className="flex flex-col items-center justify-center h-40 text-center">
                    <Building2 className="w-10 h-10 text-slate-700 mb-3" />
                    <p className="text-slate-400">Nenhum departamento encontrado</p>
                    <button onClick={openCreate} className="mt-3 text-violet-400 text-sm hover:underline">
                        Criar o primeiro departamento
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((dept) => {
                        const isExpanded = expandedDept === dept.id;
                        const isAddingToThis = showAddUser === dept.id;
                        const availableUsers = allUsers.filter(
                            (u) => !dept.users.some((du) => du.id === u.id)
                        );
                        return (
                            <div key={dept.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                                {/* Linha principal */}
                                <div className="flex items-center justify-between p-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                                            <Building2 className="w-4 h-4 text-violet-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-white text-sm">{dept.name}</p>
                                            {dept.description && (
                                                <p className="text-xs text-slate-400 truncate">{dept.description}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="flex items-center gap-1 text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full">
                                            <Users className="w-3.5 h-3.5" />
                                            {dept.users.length}
                                        </span>
                                        <button
                                            onClick={() => openEdit(dept)}
                                            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeactivate(dept)}
                                            className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setExpandedDept(isExpanded ? null : dept.id)}
                                            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                                        >
                                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Painel expandido de atendentes */}
                                {isExpanded && (
                                    <div className="border-t border-slate-800 p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Atendentes vinculados</p>
                                            <button
                                                onClick={() => { setShowAddUser(isAddingToThis ? null : dept.id); setSelectedUserId(""); }}
                                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 rounded-lg transition-all"
                                            >
                                                <UserPlus className="w-3.5 h-3.5" />
                                                Adicionar
                                            </button>
                                        </div>

                                        {/* Seletor de novo atendente */}
                                        {isAddingToThis && (
                                            <div className="flex gap-2 mb-3">
                                                <select
                                                    value={selectedUserId}
                                                    onChange={(e) => setSelectedUserId(e.target.value)}
                                                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                                                >
                                                    <option value="">Selecione um atendente...</option>
                                                    {availableUsers.map((u) => (
                                                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => handleAddUser(dept.id)}
                                                    disabled={addingUser || !selectedUserId}
                                                    className="px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl transition-all"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setShowAddUser(null)}
                                                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}

                                        {/* Lista de atendentes */}
                                        {dept.users.length === 0 ? (
                                            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-800/50 text-slate-500 text-sm">
                                                <AlertCircle className="w-4 h-4" />
                                                Nenhum atendente vinculado
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {dept.users.map((u) => (
                                                    <div key={u.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center">
                                                                <span className="text-xs font-bold text-blue-400">
                                                                    {u.name.charAt(0).toUpperCase()}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-white">{u.name}</p>
                                                                <p className="text-xs text-slate-400">{u.email}</p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemoveUser(dept.id, u.id)}
                                                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal Criar/Editar */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-white font-semibold text-lg">
                                {editingDept ? "Editar Departamento" : "Novo Departamento"}
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
                                    placeholder="Ex: Atendimento, Financeiro..."
                                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-400 block mb-1.5">Descrição</label>
                                <textarea
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    placeholder="Descrição opcional..."
                                    rows={3}
                                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white resize-none focus:outline-none focus:ring-1 focus:ring-violet-500"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 transition-all text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium transition-all text-sm"
                            >
                                {saving ? "Salvando..." : editingDept ? "Salvar" : "Criar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
