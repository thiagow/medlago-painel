const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src', 'app', 'dashboard', 'conversations', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Interfaces
content = content.replace(
    '    status?: string | null;\n    tags?: ChatTag[];\n}',
    '    status?: string | null;\n    tags?: ChatTag[];\n    patient_name?: string | null;\n}\n\ninterface PatientData {\n    id?: string;\n    nome: string;\n    telefone_principal: string;\n    cpf?: string;\n    email?: string;\n    data_nascimento?: string;\n}'
);

// 2. States
content = content.replace(
    '    const [loadingMore, setLoadingMore] = useState(false);\n',
    '    const [loadingMore, setLoadingMore] = useState(false);\n\n' +
    '    // Gestão de Pacientes\n' +
    '    const [showPatientModal, setShowPatientModal] = useState(false);\n' +
    '    const [linkedPatient, setLinkedPatient] = useState<PatientData | null>(null);\n' +
    '    const [patientForm, setPatientForm] = useState<PatientData>({ nome: "", telefone_principal: "", cpf: "", email: "", data_nascimento: "" });\n' +
    '    const [savingPatient, setSavingPatient] = useState(false);\n\n' +
    '    // Histórico Consolidado\n' +
    '    const [showHistory, setShowHistory] = useState(false);\n' +
    '    const [historyMessages, setHistoryMessages] = useState<any[]>([]);\n' +
    '    const [historyTotal, setHistoryTotal] = useState(0);\n' +
    '    const [historyPage, setHistoryPage] = useState(1);\n' +
    '    const [historyLoading, setHistoryLoading] = useState(false);\n' +
    '    const [historyChatsCount, setHistoryChatsCount] = useState(0);\n'
);

// 3. Reset states on select
content = content.replace(
    '        setSelectedChat(null);\n        setMessages([]);\n        setTab(newTab);\n',
    '        setSelectedChat(null);\n        setLinkedPatient(null);\n        setPatientForm({ nome: "", telefone_principal: "", cpf: "", email: "", data_nascimento: "" });\n        setShowHistory(false);\n        setHistoryMessages([]);\n        setMessages([]);\n        setTab(newTab);\n'
);

content = content.replace(
    /onClick=\{\(\) => setSelectedChat\(chat\)\}/g,
    'onClick={() => handleSelectChat(chat)}'
);

content = content.replace(
    '// Sincroniza refs de selectedChat',
    '    const handleSelectChat = (chat: Chat) => {\n' +
    '        setSelectedChat(chat);\n' +
    '        setLinkedPatient(null);\n' +
    '        setPatientForm({ nome: "", telefone_principal: "", cpf: "", email: "", data_nascimento: "" });\n' +
    '        setShowHistory(false);\n' +
    '        setHistoryMessages([]);\n' +
    '    };\n\n' +
    '    // Sincroniza refs de selectedChat'
);

// 4. Handlers and Modals
const utilMarker = '    // ── Funções de Utilitário ──────────────────────────────';
const handlers = 
    '    // ── Gestão de Pacientes & Histórico ─────────────────────────\n\n' +
    '    const formatPhoneMask = (v: string) => {\n' +
    '        const d = v.replace(/\\D/g, "");\n' +
    '        if (d.length <= 12) {\n' +
    '            return d.replace(/(\\d{2})(\\d{2})(\\d{4})(\\d{4})/, "+$1 ($2) $3-$4");\n' +
    '        }\n' +
    '        return d.replace(/(\\d{2})(\\d{2})(\\d{5})(\\d{4})/, "+$1 ($2) $3-$4");\n' +
    '    };\n\n' +
    '    const handleOpenPatientModal = async () => {\n' +
    '        if (!selectedChat) return;\n' +
    '        setSavingPatient(true);\n' +
    '        setShowPatientModal(true);\n' +
    '        try {\n' +
    '            const res = await fetch(`/api/patients/find-by-phone?phone=${selectedChat.phone}`);\n' +
    '            if (res.ok) {\n' +
    '                const data = await res.json();\n' +
    '                if (data.patient) {\n' +
    '                    setLinkedPatient(data.patient);\n' +
    '                    setPatientForm({\n' +
    '                        id: data.patient.id,\n' +
    '                        nome: data.patient.nome,\n' +
    '                        telefone_principal: data.patient.telefone_principal,\n' +
    '                        cpf: data.patient.cpf || "",\n' +
    '                        email: data.patient.email || "",\n' +
    '                        data_nascimento: data.patient.data_nascimento ? data.patient.data_nascimento.split("T")[0] : ""\n' +
    '                    });\n' +
    '                } else {\n' +
    '                    setLinkedPatient(null);\n' +
    '                    setPatientForm({ nome: "", telefone_principal: selectedChat.phone || "", cpf: "", email: "", data_nascimento: "" });\n' +
    '                }\n' +
    '            }\n' +
    '        } catch (error) {\n' +
    '            console.error(error);\n' +
    '        } finally {\n' +
    '            setSavingPatient(false);\n' +
    '        }\n' +
    '    };\n\n' +
    '    const handleSavePatient = async () => {\n' +
    '        setSavingPatient(true);\n' +
    '        try {\n' +
    '            const method = linkedPatient ? "PUT" : "POST";\n' +
    '            const url = linkedPatient ? `/api/patients/${linkedPatient.id}` : "/api/patients";\n' +
    '            const res = await fetch(url, {\n' +
    '                method,\n' +
    '                headers: { "Content-Type": "application/json" },\n' +
    '                body: JSON.stringify(patientForm)\n' +
    '            });\n' +
    '            if (res.ok) {\n' +
    '                toast.success(linkedPatient ? "Contato atualizado" : "Contato cadastrado");\n' +
    '                setShowPatientModal(false);\n' +
    '                setChats(prev => prev.map(c => c.phone === selectedChat?.phone ? { ...c, patient_name: patientForm.nome } : c));\n' +
    '                if (selectedChat) setSelectedChat({ ...selectedChat, patient_name: patientForm.nome });\n' +
    '            } else {\n' +
    '                toast.error("Erro ao salvar contato");\n' +
    '            }\n' +
    '        } catch (error) {\n' +
    '            toast.error("Erro ao salvar contato");\n' +
    '        } finally {\n' +
    '            setSavingPatient(false);\n' +
    '        }\n' +
    '    };\n\n' +
    '    const fetchConsolidatedHistory = async (pageToFetch = 1) => {\n' +
    '        if (!selectedChat) return;\n' +
    '        setHistoryLoading(true);\n' +
    '        try {\n' +
    '            const res = await fetch(`/api/chats/consolidated-history?phone=${selectedChat.phone}&page=${pageToFetch}&limit=60`);\n' +
    '            if (res.ok) {\n' +
    '                const data = await res.json();\n' +
    '                if (pageToFetch === 1) {\n' +
    '                    setHistoryMessages(data.messages);\n' +
    '                } else {\n' +
    '                    setHistoryMessages(prev => [...prev, ...data.messages]);\n' +
    '                }\n' +
    '                setHistoryTotal(data.total);\n' +
    '                setHistoryPage(data.page);\n' +
    '                setHistoryChatsCount(data.chatsCount);\n' +
    '            }\n' +
    '        } catch (error) {\n' +
    '            console.error("Erro histórico consolidado", error);\n' +
    '            toast.error("Erro ao carregar histórico");\n' +
    '        } finally {\n' +
    '            setHistoryLoading(false);\n' +
    '        }\n' +
    '    };\n\n' +
    '    const handleOpenHistory = () => {\n' +
    '        if (showHistory) {\n' +
    '            setShowHistory(false);\n' +
    '            return;\n' +
    '        }\n' +
    '        setShowHistory(true);\n' +
    '        fetchConsolidatedHistory(1);\n' +
    '    };\n\n';

content = content.replace(utilMarker, handlers + utilMarker);

// 5. Header modifications
const oldHeader = '<div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">\n' +
    '                                    <Phone className="w-4 h-4 text-white" />\n' +
    '                                </div>\n' +
    '                                <div>\n' +
    '                                    <p className="text-sm font-semibold text-white">\n' +
    '                                        {formatPhone(selectedChat.phone)}\n' +
    '                                        {isHistoryView && (\n' +
    '                                            <span className="ml-2 px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] rounded border border-slate-700">Somente Leitura</span>\n' +
    '                                        )}\n' +
    '                                    </p>';
const newHeader = '<div className="w-9 h-9 rounded-full bg-slate-700/50 border border-slate-600 flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-400">\n' +
    '                                    {selectedChat.patient_name ? <User className="w-4 h-4 text-white" /> : <Phone className="w-4 h-4 text-white" />}\n' +
    '                                </div>\n' +
    '                                <div>\n' +
    '                                    <p className="text-sm font-semibold text-white flex items-center gap-2">\n' +
    '                                        {selectedChat.patient_name ? <span className="text-emerald-400">{selectedChat.patient_name}</span> : formatPhone(selectedChat.phone)}\n' +
    '                                        {isHistoryView && (\n' +
    '                                            <span className="ml-2 px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] rounded border border-slate-700">Somente Leitura</span>\n' +
    '                                        )}\n' +
    '                                    </p>\n' +
    '                                    {selectedChat.patient_name && (\n' +
    '                                        <p className="text-xs text-slate-400">{formatPhone(selectedChat.phone)}</p>\n' +
    '                                    )}';
content = content.replace(oldHeader, newHeader);

// Header actions
const headerActionsEnd = '{!isHistoryView && (\n' +
    '                                    <button\n' +
    '                                        onClick={handleFinishChat}\n' +
    '                                        title="Finalizar atendimento"\n' +
    '                                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors ml-2 border border-transparent hover:border-red-500/30"\n' +
    '                                    >\n' +
    '                                        <CheckCircle2 className="w-5 h-5" />\n' +
    '                                    </button>\n' +
    '                                )}\n' +
    '                            </div>';
const newHeaderActions = '{!isHistoryView && (\n' +
    '                                    <button\n' +
    '                                        onClick={handleFinishChat}\n' +
    '                                        title="Finalizar atendimento"\n' +
    '                                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors ml-2 border border-transparent hover:border-red-500/30"\n' +
    '                                    >\n' +
    '                                        <CheckCircle2 className="w-5 h-5" />\n' +
    '                                    </button>\n' +
    '                                )}\n' +
    '                                <div className="w-px h-6 bg-slate-800 mx-1"></div>\n' +
    '                                <button\n' +
    '                                    onClick={handleOpenHistory}\n' +
    '                                    title="Histórico Consolidado"\n' +
    '                                    className={`p-2 rounded-xl transition-all ${showHistory ? "bg-violet-600/20 text-violet-400 border border-violet-500/30" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}\n' +
    '                                >\n' +
    '                                    <History className="w-5 h-5" />\n' +
    '                                </button>\n' +
    '                                <button\n' +
    '                                    onClick={handleOpenPatientModal}\n' +
    '                                    title={selectedChat.patient_name ? "Editar Contato" : "Salvar Contato"}\n' +
    '                                    className={`p-2 rounded-xl transition-all ${selectedChat.patient_name ? "text-emerald-400 bg-emerald-900/40 border border-emerald-500/30 hover:bg-emerald-900/60" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}\n' +
    '                                >\n' +
    '                                    {selectedChat.patient_name ? <User className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}\n' +
    '                                </button>\n' +
    '                            </div>';
content = content.replace(headerActionsEnd, newHeaderActions);

// 6. List Items
content = content.replace(
    /<h3 className="font-medium text-white text-sm truncate pr-2">\s*\{formatPhone\(chat\.phone\)\}\s*<\/h3>/g,
    '<h3 className="font-medium text-white text-sm truncate pr-2">\n' +
    '                                            {chat.patient_name ? (\n' +
    '                                                <div className="flex items-center gap-1.5 text-emerald-400">\n' +
    '                                                    <User className="w-3.5 h-3.5" />\n' +
    '                                                    <span className="truncate max-w-[120px]">{chat.patient_name}</span>\n' +
    '                                                </div>\n' +
    '                                            ) : formatPhone(chat.phone)}\n' +
    '                                        </h3>'
);

content = content.replace(
    /<span className="text-\[10px\] text-slate-500">\{formatDate\(chat\.last_message_at \|\| chat\.updated_at\)\}<\/span>\n                                        <\/div>\n                                    <\/div>\n                                    <div className="flex items-center gap-2 mt-1\.5 flex-wrap">/g,
    '<span className="text-[10px] text-slate-500">{formatDate(chat.last_message_at || chat.updated_at)}</span>\n' +
    '                                        </div>\n' +
    '                                    </div>\n' +
    '                                    {chat.patient_name && <p className="text-[10px] text-slate-500 mt-1">{formatPhone(chat.phone)}</p>}\n' +
    '                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">'
);
content = content.replace(
    /<span className="text-\[10px\] text-slate-500">\{formatDate\(chat\.last_message_at \|\| chat\.updated_at\)\}<\/span>\n                                        <\/div>\s*<\/div>\s*<div className="flex items-center gap-2 mt-1\.5 flex-wrap">/g,
    '<span className="text-[10px] text-slate-500">{formatDate(chat.last_message_at || chat.updated_at)}</span>\n' +
    '                                        </div>\n' +
    '                                    </div>\n' +
    '                                    {chat.patient_name && <p className="text-[10px] text-slate-500 mt-1">{formatPhone(chat.phone)}</p>}\n' +
    '                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">'
);

// 7. Modals
const modalsHTML = 
    '\n        {/* ── Modal de Cadastro/Edição de Paciente ───────────────── */}\n' +
    '        {showPatientModal && (\n' +
    '            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">\n' +
    '                <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">\n' +
    '                    <div className="flex items-center justify-between p-5 border-b border-slate-800">\n' +
    '                        <h3 className="text-white font-semibold text-lg flex items-center gap-2">\n' +
    '                            {linkedPatient ? <User className="w-5 h-5 text-emerald-400" /> : <UserPlus className="w-5 h-5 text-emerald-400" />}\n' +
    '                            {linkedPatient ? "Editar Contato" : "Salvar Contato"}\n' +
    '                        </h3>\n' +
    '                        <button onClick={() => setShowPatientModal(false)} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">\n' +
    '                            <X className="w-5 h-5" />\n' +
    '                        </button>\n' +
    '                    </div>\n' +
    '                    <div className="p-5 space-y-4">\n' +
    '                        <div>\n' +
    '                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nome / Identificação *</label>\n' +
    '                            <input\n' +
    '                                autoFocus\n' +
    '                                type="text"\n' +
    '                                value={patientForm.nome}\n' +
    '                                onChange={e => setPatientForm({ ...patientForm, nome: e.target.value })}\n' +
    '                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"\n' +
    '                                placeholder="Ex: João Silva"\n' +
    '                            />\n' +
    '                        </div>\n' +
    '                        <div>\n' +
    '                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Telefone WhatsApp</label>\n' +
    '                            <input\n' +
    '                                type="text"\n' +
    '                                readOnly\n' +
    '                                value={formatPhoneMask(patientForm.telefone_principal || "")}\n' +
    '                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-400 cursor-not-allowed"\n' +
    '                            />\n' +
    '                        </div>\n' +
    '                        <div className="grid grid-cols-2 gap-4">\n' +
    '                            <div>\n' +
    '                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Data Nascimento</label>\n' +
    '                                <input\n' +
    '                                    type="date"\n' +
    '                                    value={patientForm.data_nascimento}\n' +
    '                                    onChange={e => setPatientForm({ ...patientForm, data_nascimento: e.target.value })}\n' +
    '                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"\n' +
    '                                />\n' +
    '                            </div>\n' +
    '                            <div>\n' +
    '                                <label className="block text-sm font-medium text-slate-300 mb-1.5">CPF</label>\n' +
    '                                <input\n' +
    '                                    type="text"\n' +
    '                                    value={patientForm.cpf}\n' +
    '                                    onChange={e => setPatientForm({ ...patientForm, cpf: e.target.value })}\n' +
    '                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"\n' +
    '                                    placeholder="000.000.000-00"\n' +
    '                                />\n' +
    '                            </div>\n' +
    '                        </div>\n' +
    '                        <div>\n' +
    '                            <label className="block text-sm font-medium text-slate-300 mb-1.5">E-mail</label>\n' +
    '                            <input\n' +
    '                                type="email"\n' +
    '                                value={patientForm.email}\n' +
    '                                onChange={e => setPatientForm({ ...patientForm, email: e.target.value })}\n' +
    '                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"\n' +
    '                                placeholder="paciente@email.com"\n' +
    '                            />\n' +
    '                        </div>\n' +
    '                    </div>\n' +
    '                    <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-800 bg-slate-800/30 rounded-b-2xl">\n' +
    '                        <button\n' +
    '                            onClick={() => setShowPatientModal(false)}\n' +
    '                            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"\n' +
    '                        >\n' +
    '                            Cancelar\n' +
    '                        </button>\n' +
    '                        <button\n' +
    '                            onClick={handleSavePatient}\n' +
    '                            disabled={!patientForm.nome || savingPatient}\n' +
    '                            className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"\n' +
    '                        >\n' +
    '                            {savingPatient ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}\n' +
    '                            Salvar Contato\n' +
    '                        </button>\n' +
    '                    </div>\n' +
    '                </div>\n' +
    '            </div>\n' +
    '        )}\n\n' +
    '        {/* ── Drawer de Histórico Consolidado ───────────────── */}\n' +
    '        {showHistory && (\n' +
    '            <div className="absolute top-0 right-0 bottom-0 w-[450px] bg-slate-900 border-l border-slate-800 shadow-2xl z-40 flex flex-col transform transition-transform duration-300">\n' +
    '                <div className="h-16 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">\n' +
    '                    <div className="flex items-center gap-3">\n' +
    '                        <div className="p-2 bg-violet-500/10 rounded-xl">\n' +
    '                            <History className="w-5 h-5 text-violet-400" />\n' +
    '                        </div>\n' +
    '                        <div>\n' +
    '                            <h3 className="font-semibold text-white">Histórico Consolidado</h3>\n' +
    '                            <p className="text-xs text-slate-400">{historyTotal} mensagens em {historyChatsCount} chats</p>\n' +
    '                        </div>\n' +
    '                    </div>\n' +
    '                    <button onClick={() => setShowHistory(false)} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors">\n' +
    '                        <X className="w-5 h-5" />\n' +
    '                    </button>\n' +
    '                </div>\n\n' +
    '                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/50">\n' +
    '                    {historyLoading && historyPage === 1 ? (\n' +
    '                        <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">\n' +
    '                            <span className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />\n' +
    '                            <p className="text-sm">Buscando histórico completo...</p>\n' +
    '                        </div>\n' +
    '                    ) : historyMessages.length === 0 ? (\n' +
    '                        <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">\n' +
    '                            <MessageSquare className="w-10 h-10 opacity-20" />\n' +
    '                            <p className="text-sm">Nenhum histórico encontrado para este número.</p>\n' +
    '                        </div>\n' +
    '                    ) : (\n' +
    '                        <>\n' +
    '                            {historyMessages.map((msg, idx) => {\n' +
    '                                const prevMsg = idx > 0 ? historyMessages[idx - 1] : null;\n' +
    '                                const showChatDivider = !prevMsg || msg.conversation_id !== prevMsg.conversation_id;\n' +
    '                                \n' +
    '                                return (\n' +
    '                                    <div key={`hist_${msg.id}`}>\n' +
    '                                        {showChatDivider && (\n' +
    '                                            <div className="flex items-center justify-center my-6">\n' +
    '                                                <div className="bg-slate-800/80 px-4 py-1.5 rounded-full border border-slate-700 flex items-center gap-2">\n' +
    '                                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />\n' +
    '                                                    <span className="text-[11px] font-medium text-slate-300">\n' +
    '                                                        Atendimento: {formatDate(msg.chat_created_at || msg.created_at)}\n' +
    '                                                    </span>\n' +
    '                                                </div>\n' +
    '                                            </div>\n' +
    '                                        )}\n' +
    '                                        <div className={`flex flex-col max-w-[85%] ${msg.active ? \'ml-auto items-end\' : \'mr-auto items-start\'} mb-3`}>\n' +
    '                                            <div className={`px-4 py-2.5 rounded-2xl ${msg.active ? \'bg-blue-600 text-white rounded-tr-sm\' : \'bg-slate-800 text-slate-200 border border-slate-700/50 rounded-tl-sm\'}`}>\n' +
    '                                                {msg.active && msg.sender_name && (\n' +
    '                                                    <div className="text-[10px] font-medium text-blue-200 mb-1">{msg.sender_name} (Equipe)</div>\n' +
    '                                                )}\n' +
    '                                                {msg.media_url ? (\n' +
    '                                                    <a href={msg.media_url} target="_blank" rel="noreferrer" className="flex flex-col bg-black/20 rounded-xl p-2 gap-2 max-w-[200px] hover:bg-black/30 transition-colors">\n' +
    '                                                        {msg.media_type?.startsWith(\'image/\') ? (\n' +
    '                                                            // eslint-disable-next-line @next/next/no-img-element\n' +
    '                                                            <img src={msg.media_url} alt="Mídia" className="rounded-lg max-h-32 object-cover" />\n' +
    '                                                        ) : (\n' +
    '                                                            <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center">\n' +
    '                                                                <FileText className="w-6 h-6 text-slate-400" />\n' +
    '                                                            </div>\n' +
    '                                                        )}\n' +
    '                                                        <span className="text-xs truncate">{msg.media_name || "Mídia anexa"}</span>\n' +
    '                                                    </a>\n' +
    '                                                ) : msg.bot_message || msg.user_message ? (\n' +
    '                                                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.bot_message || msg.user_message}</p>\n' +
    '                                                ) : (\n' +
    '                                                    <p className="text-sm italic text-slate-400 flex items-center gap-1">\n' +
    '                                                        <Ban className="w-4 h-4" /> Mensagem apagada\n' +
    '                                                    </p>\n' +
    '                                                )}\n' +
    '                                            </div>\n' +
    '                                            <span className="text-[10px] text-slate-500 mt-1 px-1">{formatDate(msg.created_at)}</span>\n' +
    '                                        </div>\n' +
    '                                    </div>\n' +
    '                                );\n' +
    '                            })}\n' +
    '                            \n' +
    '                            {historyMessages.length < historyTotal && (\n' +
    '                                <div className="flex justify-center pt-4 pb-8">\n' +
    '                                    <button \n' +
    '                                        onClick={() => fetchConsolidatedHistory(historyPage + 1)}\n' +
    '                                        disabled={historyLoading}\n' +
    '                                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors border border-slate-700 flex items-center gap-2"\n' +
    '                                    >\n' +
    '                                        {historyLoading ? <span className="w-4 h-4 border-2 border-slate-400/30 border-t-slate-400 rounded-full animate-spin" /> : null}\n' +
    '                                        Carregar mais antigas\n' +
    '                                    </button>\n' +
    '                                </div>\n' +
    '                            )}\n' +
    '                        </>\n' +
    '                    )}\n' +
    '                </div>\n' +
    '            </div>\n' +
    '        )}\n';

content = content.replace(
    /<\/div>\s*<\/div>\s*\);\s*}\s*$/g,
    '</div>\n            </div>\n' + modalsHTML + '        </>\n    );\n}'
);

content = content.replace(
    /return \(\s*<div className="flex h-full overflow-hidden">/g,
    'return (\n        <>\n        <div className="flex h-full overflow-hidden">'
);

content = content.replace(
    'import { Send, Image, FileText, Ban, Bot, HandMetal, Play, Pause, Download, Volume2, Plus, Calendar, Lock, CheckCircle2, Phone, X, AlertCircle } from "lucide-react";',
    'import { Send, Image, FileText, Ban, Bot, HandMetal, Play, Pause, Download, Volume2, Plus, Calendar, Lock, CheckCircle2, Phone, X, AlertCircle, User, UserPlus, History, Save } from "lucide-react";'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Script executado. Validando.');
