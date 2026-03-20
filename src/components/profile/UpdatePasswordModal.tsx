"use client";

import { useState } from "react";
import { Lock, AlertCircle, X, ShieldCheck } from "lucide-react";

interface UpdatePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function UpdatePasswordModal({ isOpen, onClose }: UpdatePasswordModalProps) {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        
        if (newPassword !== confirmPassword) {
            setError("A nova senha e a confirma\u00e7\u00e3o n\u00e3o coincidem.");
            return;
        }

        if (newPassword.length < 6) {
            setError("A nova senha deve ter no m\u00ednimo 6 caracteres.");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch("/api/profile/password", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Erro ao alterar a senha.");
            } else {
                setSuccess(true);
                setTimeout(() => {
                    handleClose();
                }, 2000);
            }
        } catch (err) {
            setError("Ocorreu um erro de rede. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setError("");
        setSuccess(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={handleClose} />
            
            <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden transform animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Lock className="w-5 h-5 text-indigo-400" />
                        Trocar Senha
                    </h2>
                    <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                {success ? (
                    <div className="p-8 flex flex-col items-center justify-center text-center space-y-4">
                        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
                            <ShieldCheck className="w-8 h-8 text-emerald-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Senha atualizada!</h3>
                        <p className="text-slate-400 text-sm">Sua senha foi alterada com sucesso.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6">
                        <div className="space-y-4">
                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <p>{error}</p>
                                </div>
                            )}
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Senha Atual
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="pt-2">
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Nova Senha
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="No m\u00ednimo 6 caracteres"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Confirmar Nova Senha
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                                disabled={loading}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {loading ? "Salvando..." : "Alterar Senha"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
