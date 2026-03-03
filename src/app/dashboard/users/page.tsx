"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    UserPlus,
    Pencil,
    ToggleLeft,
    ToggleRight,
    KeyRound,
    Shield,
    User,
    Copy,
} from "lucide-react";
import toast from "react-hot-toast";

interface UserData {
    id: string;
    name: string;
    email: string;
    role: string;
    active: boolean;
    created_at: string;
    must_change_password: boolean;
}

interface ModalState {
    type: "create" | "edit" | "reset" | null;
    user?: UserData | null;
}

const ROLES = [
    { value: "admin", label: "Administrador" },
    { value: "atendente", label: "Atendente" },
];

export default function UsersPage() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<ModalState>({ type: null });
    const [form, setForm] = useState({ name: "", email: "", password: "", userRole: "atendente" });
    const [saving, setSaving] = useState(false);
    const [tempPassword, setTempPassword] = useState("");

    const fetchUsers = async () => {
        try {
            const res = await fetch("/api/users");
            if (!res.ok) return;
            const data = await res.json();
            setUsers(data.users || []);
        } catch (e) {
            console.error("Erro ao buscar usuários:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const openCreate = () => {
        setForm({ name: "", email: "", password: "", userRole: "atendente" });
        setModal({ type: "create" });
    };

    const openEdit = (user: UserData) => {
        setForm({ name: user.name, email: user.email, password: "", userRole: user.role });
        setModal({ type: "edit", user });
    };

    const handleCreateUser = async () => {
        if (!form.name || !form.email || !form.password) return toast.error("Preencha todos os campos");
        setSaving(true);
        try {
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: form.name, email: form.email, password: form.password, userRole: form.userRole }),
            });
            if (!res.ok) {
                const d = await res.json();
                return toast.error(d.error || "Erro ao criar usuário");
            }
            toast.success("Usuário criado com sucesso!");
            setModal({ type: null });
            fetchUsers();
        } catch {
            toast.error("Erro ao criar usuário");
        } finally {
            setSaving(false);
        }
    };

    const handleEditUser = async () => {
        if (!modal.user || !form.name || !form.email) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/users/${modal.user.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: form.name, email: form.email, userRole: form.userRole }),
            });
            if (!res.ok) throw new Error();
            toast.success("Usuário atualizado!");
            setModal({ type: null });
            fetchUsers();
        } catch {
            toast.error("Erro ao atualizar usuário");
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (user: UserData) => {
        try {
            const res = await fetch(`/api/users/${user.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active: !user.active }),
            });
            if (!res.ok) throw new Error();
            toast.success(user.active ? "Usuário desativado" : "Usuário ativado");
            fetchUsers();
        } catch {
            toast.error("Erro ao alterar status");
        }
    };

    const handleResetPassword = async (user: UserData) => {
        setSaving(true);
        try {
            const res = await fetch(`/api/users/${user.id}/reset-password`, { method: "POST" });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setTempPassword(data.tempPassword);
            setModal({ type: "reset", user });
        } catch {
            toast.error("Erro ao resetar senha");
        } finally {
            setSaving(false);
        }
    };

    const formatDate = (d: string) => {
        try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); }
        catch { return "—"; }
    };

    return (
        <div className="h-full overflow-y-auto bg-slate-950 p-6">
            {/* Modal */}
            {modal.type && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                        {modal.type === "reset" ? (
                            <>
                                <h3 className="text-white font-semibold text-lg mb-2">Senha Temporária</h3>
                                <p className="text-slate-400 text-sm mb-4">
                                    Compartilhe esta senha com <span className="text-white font-medium">{modal.user?.name}</span>. Ela deverá ser trocada no próximo acesso.
                                </p>
                                <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 mb-4">
                                    <code className="flex-1 text-cyan-400 font-mono text-sm">{tempPassword}</code>
                                    <button onClick={() => { navigator.clipboard.writeText(tempPassword); toast.success("Copiado!"); }} className="text-slate-400 hover:text-white transition-all">
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>
                                <button onClick={() => setModal({ type: null })} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all text-sm">
                                    Fechar
                                </button>
                            </>
                        ) : (
                            <>
                                <h3 className="text-white font-semibold text-lg mb-4">
                                    {modal.type === "create" ? "Criar Novo Usuário" : "Editar Usuário"}
                                </h3>
                                <div className="space-y-4">
                                    {[
                                        { label: "Nome", id: "user-name", value: form.name, setter: (v: string) => setForm(f => ({ ...f, name: v })), type: "text", placeholder: "Nome completo" },
                                        { label: "Email", id: "user-email", value: form.email, setter: (v: string) => setForm(f => ({ ...f, email: v })), type: "email", placeholder: "email@exemplo.com" },
                                        ...(modal.type === "create" ? [{ label: "Senha Temporária", id: "user-password", value: form.password, setter: (v: string) => setForm(f => ({ ...f, password: v })), type: "password", placeholder: "••••••••" }] : []),
                                    ].map(({ label, id, value, setter, type, placeholder }) => (
                                        <div key={id}>
                                            <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>
                                            <input
                                                id={id}
                                                type={type}
                                                value={value}
                                                onChange={(e) => setter(e.target.value)}
                                                placeholder={placeholder}
                                                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all"
                                            />
                                        </div>
                                    ))}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Perfil</label>
                                        <select
                                            id="user-role"
                                            value={form.userRole}
                                            onChange={(e) => setForm(f => ({ ...f, userRole: e.target.value }))}
                                            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        >
                                            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button onClick={() => setModal({ type: null })} className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 transition-all text-sm">
                                        Cancelar
                                    </button>
                                    <button
                                        id="btn-save-user"
                                        onClick={modal.type === "create" ? handleCreateUser : handleEditUser}
                                        disabled={saving}
                                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all text-sm disabled:opacity-60"
                                    >
                                        {saving ? "Salvando..." : "Salvar"}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-white">Usuários</h1>
                    <p className="text-slate-400 text-sm mt-0.5">Gerenciamento de acesso ao painel</p>
                </div>
                <button
                    id="btn-create-user"
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-500/20"
                >
                    <UserPlus className="w-4 h-4" />
                    Novo Usuário
                </button>
            </div>

            {/* Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <span className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-800">
                                {["Usuário", "Perfil", "Status", "Criado em", "Ações"].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-white">{user.name}</p>
                                                <p className="text-xs text-slate-500">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="flex items-center gap-1.5 text-xs">
                                            {user.role === "admin" ? <Shield className="w-3.5 h-3.5 text-purple-400" /> : <User className="w-3.5 h-3.5 text-blue-400" />}
                                            <span className={user.role === "admin" ? "text-purple-400" : "text-blue-400"}>
                                                {ROLES.find(r => r.value === user.role)?.label || user.role}
                                            </span>
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs px-2 py-1 rounded-full ${user.active ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700 text-slate-400"}`}>
                                            {user.active ? "Ativo" : "Inativo"}
                                        </span>
                                        {user.must_change_password && (
                                            <span className="ml-2 text-xs px-2 py-1 rounded-full bg-amber-500/15 text-amber-400">Senha temp.</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(user.created_at)}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1">
                                            <button id={`btn-edit-${user.id}`} onClick={() => openEdit(user)} title="Editar" className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button id={`btn-toggle-${user.id}`} onClick={() => handleToggleActive(user)} title={user.active ? "Desativar" : "Ativar"} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
                                                {user.active ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4 text-slate-500" />}
                                            </button>
                                            <button id={`btn-reset-${user.id}`} onClick={() => handleResetPassword(user)} title="Resetar senha" disabled={saving} className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-700 rounded-lg transition-all">
                                                <KeyRound className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
