"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

export default function ChangePasswordPage() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error("As senhas não coincidem");
            return;
        }
        if (newPassword.length < 6) {
            toast.error("A nova senha deve ter pelo menos 6 caracteres");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            if (!res.ok) {
                const data = await res.json();
                toast.error(data.error || "Erro ao alterar senha");
                return;
            }

            toast.success("Senha alterada com sucesso! Faça login novamente.");
            await logout();
        } catch {
            toast.error("Erro interno. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full opacity-10 blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500 rounded-full opacity-10 blur-3xl" />
            </div>

            <div className="relative w-full max-w-md">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
                    <div className="flex flex-col items-center mb-6">
                        <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-400 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-amber-500/30">
                            <ShieldCheck className="w-7 h-7 text-white" />
                        </div>
                        <h1 className="text-xl font-bold text-white">Troca de Senha Obrigatória</h1>
                        <p className="text-slate-400 text-sm mt-1 text-center">
                            Olá, <span className="text-blue-400 font-medium">{user?.name}</span>! Por segurança, defina uma nova senha.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {[
                            { label: "Senha Atual", value: currentPassword, setter: setCurrentPassword, show: showCurrent, toggle: () => setShowCurrent(!showCurrent), id: "current-password" },
                            { label: "Nova Senha", value: newPassword, setter: setNewPassword, show: showNew, toggle: () => setShowNew(!showNew), id: "new-password" },
                            { label: "Confirmar Nova Senha", value: confirmPassword, setter: setConfirmPassword, show: showNew, toggle: () => setShowNew(!showNew), id: "confirm-password" },
                        ].map(({ label, value, setter, show, toggle, id }) => (
                            <div key={id}>
                                <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>
                                <div className="relative">
                                    <input
                                        id={id}
                                        type={show ? "text" : "password"}
                                        value={value}
                                        onChange={(e) => setter(e.target.value)}
                                        required
                                        placeholder="••••••••"
                                        className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                    <button type="button" onClick={toggle} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                                        {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                        ))}

                        <button
                            id="btn-change-password"
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold rounded-xl transition-all disabled:opacity-60 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Salvando...</>
                            ) : "Salvar Nova Senha"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
