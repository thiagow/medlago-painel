"use client";

import { useState, useEffect } from "react";
import { 
    Users, Plus, Search, MoreVertical, Edit2, 
    Trash2, Phone, Mail, FileText, Calendar, AlertCircle
} from "lucide-react";

interface Patient {
    id: string;
    nome: string;
    cpf: string | null;
    telefone_principal: string | null;
    email: string | null;
    data_nascimento: string | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export default function PatientsPage() {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    
    // Pagination and sorting states
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    
    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<"create" | "edit">("create");
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [saving, setSaving] = useState(false);

    // Form states
    const [formData, setFormData] = useState({
        nome: "",
        telefone_principal: "",
        cpf: "",
        email: "",
        data_nascimento: ""
    });

    const [error, setError] = useState("");

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchPatients();
        }, 500); // debounce de 500ms
        return () => clearTimeout(timeoutId);
    }, [searchQuery, currentPage, sortOrder]);

    const fetchPatients = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/patients?page=${currentPage}&limit=50&search=${encodeURIComponent(searchQuery)}&sort=${sortOrder}`);
            const data = await res.json();
            if (res.ok) {
                setPatients(data.patients || []);
                setTotalPages(data.pagination?.totalPages || 1);
            }
        } catch (error) {
            console.error("Erro ao carregar pacientes:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        setCurrentPage(1); // Reset page on new search
    };

    const handleOpenCreateModal = () => {
        setModalMode("create");
        setSelectedPatient(null);
        setFormData({
            nome: "",
            telefone_principal: "",
            cpf: "",
            email: "",
            data_nascimento: ""
        });
        setError("");
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (patient: Patient) => {
        setModalMode("edit");
        setSelectedPatient(patient);
        setFormData({
            nome: patient.nome || "",
            telefone_principal: patient.telefone_principal || "",
            cpf: patient.cpf || "",
            email: patient.email || "",
            data_nascimento: patient.data_nascimento ? patient.data_nascimento.split("T")[0] : ""
        });
        setError("");
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setError("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!formData.nome.trim() || !formData.telefone_principal.trim()) {
            setError("Os campos Nome e WhatsApp/Telefone s\u00e3o obrigat\u00f3rios.");
            return;
        }

        setSaving(true);

        const payload = {
            nome: formData.nome.trim(),
            telefone_principal: formData.telefone_principal.trim(),
            cpf: formData.cpf.trim() || null,
            email: formData.email.trim() || null,
            data_nascimento: formData.data_nascimento || null
        };

        try {
            const url = modalMode === "create" ? "/api/patients" : `/api/patients/${selectedPatient?.id}`;
            const method = modalMode === "create" ? "POST" : "PUT";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Ocorreu um erro ao salvar o paciente.");
                return;
            }

            await fetchPatients();
            handleCloseModal();
        } catch (error) {
            setError("Ocorreu um erro de rede ao salvar o paciente.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este paciente? Esta a\u00e7\u00e3o \u00e9 irrevers\u00edvel e pode falhar se o paciente possuir agendamentos.")) return;
        
        try {
            const res = await fetch(`/api/patients/${id}`, { method: "DELETE" });
            if (res.ok) {
                fetchPatients();
            } else {
                const data = await res.json();
                alert(data.error || "Erro ao deletar paciente.");
            }
        } catch (error) {
            alert("Erro de conex\u00e3o ao deletar paciente.");
        }
    };

    const formatPhone = (phone: string | null) => {
        if (!phone) return "N/A";
        return phone.replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, '+$1 ($2) $3-$4');
    };

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-400 flex items-center justify-center shrink-0">
                            <Users className="w-5 h-5 text-white" />
                        </div>
                        Pacientes
                    </h1>
                    <p className="text-slate-400 mt-1 ml-13">Gerencie a lista de pacientes e recados rápidos.</p>
                </div>
                
                <button
                    onClick={handleOpenCreateModal}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-medium transition-colors w-full sm:w-auto justify-center"
                >
                    <Plus className="w-5 h-5" />
                    Novo Paciente
                </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-800 flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, CPF ou WhatsApp..."
                            value={searchQuery}
                            onChange={handleSearchChange}
                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium placeholder:text-slate-600"
                        />
                    </div>
                </div>

                <div className="overflow-y-auto max-h-[60vh] min-h-[400px]">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur shadow-sm">
                            <tr className="border-b border-slate-800 text-slate-400 text-sm">
                                <th 
                                    className="p-4 font-medium min-w-[200px] cursor-pointer hover:text-indigo-400 select-none group flex items-center gap-2"
                                    onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                                >
                                    Paciente
                                    <span className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                                        {sortOrder === "asc" ? "A-Z" : "Z-A"}
                                    </span>
                                </th>
                                <th className="p-4 font-medium">WhatsApp</th>
                                <th className="p-4 font-medium">CPF</th>
                                <th className="p-4 font-medium">Cadastro</th>
                                <th className="p-4 font-medium text-right w-[100px]">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {loading && patients.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500 flex-col items-center justify-center">
                                        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                        Carregando pacientes...
                                    </td>
                                </tr>
                            ) : patients.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500">
                                        Nenhum paciente encontrado.
                                    </td>
                                </tr>
                            ) : (
                                patients.map((patient) => (
                                    <tr key={patient.id} className="hover:bg-slate-800/50 transition-colors group">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                                                    <span className="text-sm font-bold text-slate-300">
                                                        {patient.nome ? patient.nome.charAt(0).toUpperCase() : "?"}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-white group-hover:text-indigo-400 transition-colors">
                                                        {patient.nome || "Sem Nome"}
                                                    </p>
                                                    {patient.email && (
                                                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                            <Mail className="w-3 h-3" /> {patient.email}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-300 font-medium">
                                            <div className="flex items-center gap-2">
                                                <Phone className="w-4 h-4 text-slate-500" />
                                                {formatPhone(patient.telefone_principal)}
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-400 text-sm">
                                            {patient.cpf ? (
                                                <div className="flex items-center gap-2">
                                                    <FileText className="w-4 h-4 text-slate-600" />
                                                    {patient.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                                                </div>
                                            ) : (
                                                <span className="text-slate-600 italic">Não informado</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-slate-400 text-sm">
                                            {patient.created_at ? new Date(patient.created_at).toLocaleDateString('pt-BR') : "--"}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleOpenEditModal(patient)}
                                                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
                                                    title="Editar"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(patient.id)}
                                                    className="p-2 bg-slate-800 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-slate-700 hover:border-red-500/30"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginação */}
                <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
                    <span className="text-sm text-slate-400 font-medium">
                        Página {currentPage} de {totalPages === 0 ? 1 : totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1 || loading}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            Anterior
                        </button>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage >= totalPages || loading}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            Próxima
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={handleCloseModal} />
                    
                    <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden transform animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-800">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                {modalMode === "create" ? (
                                    <>
                                        <Plus className="w-5 h-5 text-indigo-400" />
                                        Cadastrar Novo Paciente
                                    </>
                                ) : (
                                    <>
                                        <Edit2 className="w-5 h-5 text-indigo-400" />
                                        Editar Paciente
                                    </>
                                )}
                            </h2>
                        </div>
                        
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
                                        Nome Completo <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.nome}
                                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                        placeholder="Ex: João da Silva..."
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">
                                        WhatsApp / Telefone <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.telefone_principal}
                                        onChange={(e) => setFormData({ ...formData, telefone_principal: e.target.value.replace(/\D/g, '') })}
                                        placeholder="Ex: 5511999999999"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Insira apenas números com código de país e DDD.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">
                                        E-mail
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="Opcional..."
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">
                                            CPF
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.cpf}
                                            onChange={(e) => setFormData({ ...formData, cpf: e.target.value.replace(/\D/g, '') })}
                                            placeholder="Somente números..."
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">
                                            Nascimento
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.data_nascimento}
                                            onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                                    disabled={saving}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving ? "Salvando..." : modalMode === "create" ? "Cadastrar" : "Salvar Alterações"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
