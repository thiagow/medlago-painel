"use client";

import { useEffect, useState, useCallback } from "react";
import {
    ChevronLeft,
    ChevronRight,
    CalendarDays,
    List,
    CalendarCheck,
    Clock3,
    X,
    User,
    Stethoscope,
    CreditCard,
    FileText,
    Calendar,
} from "lucide-react";
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    addDays,
    addMonths,
    subMonths,
    addWeeks,
    subWeeks,
    addDays as addDaysAlias,
    isSameDay,
    isSameMonth,
    parseISO,
    startOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "month" | "week" | "day" | "list";

interface Agendamento {
    id: number;
    created_at: string | null;
    data_atendimento: string | null; // "YYYY-MM-DD"
    horario: string | null;          // "HH:MM:SS"
    paciente_cpf: string | null;
    paciente_nome: string | null;
    profissional_id: string | null;
    profissional_nome: string | null;
    tipo_atendimento_id: number | null;
    tipo_atendimento_nome: string | null;
    convenio_id: string | null;
    convenio_nome: string | null;
    unidade_id: number | null;
    status: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(status: string): string {
    switch (status.toLowerCase()) {
        case "agendado":    return "bg-blue-500/20 text-blue-300 border-blue-500/30";
        case "confirmado":  return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
        case "cancelado":   return "bg-red-500/20 text-red-300 border-red-500/30";
        case "atendido":    return "bg-violet-500/20 text-violet-300 border-violet-500/30";
        default:            return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
}

function statusDot(status: string): string {
    switch (status.toLowerCase()) {
        case "agendado":    return "bg-blue-400";
        case "confirmado":  return "bg-emerald-400";
        case "cancelado":   return "bg-red-400";
        case "atendido":    return "bg-violet-400";
        default:            return "bg-slate-400";
    }
}

function formatHorario(horario: string | null): string {
    if (!horario) return "";
    return horario.slice(0, 5); // "HH:MM"
}

function horarioToMinutes(horario: string | null): number {
    if (!horario) return 0;
    const [h, m] = horario.split(":").map(Number);
    return h * 60 + m;
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7h - 19h

// ─── Modal de Detalhes ─────────────────────────────────────────────────────────

function DetailModal({ ag, onClose }: { ag: Agendamento; onClose: () => void }) {
    const dataFormatted = ag.data_atendimento
        ? format(parseISO(ag.data_atendimento), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
        : "—";
    const criadoEm = ag.created_at
        ? format(parseISO(ag.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
        : "—";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <CalendarCheck className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-white">Detalhes do Agendamento</h2>
                            <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border mt-0.5 ${statusColor(ag.status)}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusDot(ag.status)}`} />
                                {ag.status.charAt(0).toUpperCase() + ag.status.slice(1)}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-3.5">
                    <Row icon={<User className="w-4 h-4 text-blue-400" />} label="Paciente">
                        <p className="text-white text-sm font-medium">{ag.paciente_nome ?? "—"}</p>
                        <p className="text-slate-400 text-xs">{ag.paciente_cpf ?? "—"}</p>
                    </Row>
                    <Row icon={<Calendar className="w-4 h-4 text-cyan-400" />} label="Data e Hora">
                        <p className="text-white text-sm font-medium capitalize">{dataFormatted}</p>
                        <p className="text-slate-400 text-xs">{formatHorario(ag.horario)}</p>
                    </Row>
                    <Row icon={<Stethoscope className="w-4 h-4 text-violet-400" />} label="Profissional">
                        <p className="text-white text-sm">{ag.profissional_nome ?? (ag.profissional_id ? `ID ${ag.profissional_id}` : "—")}</p>
                    </Row>
                    <Row icon={<FileText className="w-4 h-4 text-emerald-400" />} label="Tipo de Atendimento">
                        <p className="text-white text-sm">{ag.tipo_atendimento_nome ?? (ag.tipo_atendimento_id ? `ID ${ag.tipo_atendimento_id}` : "—")}</p>
                    </Row>
                    <Row icon={<CreditCard className="w-4 h-4 text-amber-400" />} label="Convênio">
                        <p className="text-white text-sm">{ag.convenio_nome ?? (ag.convenio_id ? `ID ${ag.convenio_id}` : "—")}</p>
                    </Row>
                    <div className="pt-2 border-t border-slate-800">
                        <p className="text-xs text-slate-500">Agendado em {criadoEm}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center mt-0.5 shrink-0">{icon}</div>
            <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                {children}
            </div>
        </div>
    );
}

// ─── Visualização Mês ──────────────────────────────────────────────────────────

function MonthView({ currentDate, agendamentos, onSelect }: { currentDate: Date; agendamentos: Agendamento[]; onSelect: (a: Agendamento) => void }) {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const weeks: Date[][] = [];
    let day = startDate;
    while (day <= endDate) {
        const week: Date[] = [];
        for (let i = 0; i < 7; i++) {
            week.push(day);
            day = addDays(day, 1);
        }
        weeks.push(week);
    }

    const byDate: Record<string, Agendamento[]> = {};
    for (const ag of agendamentos) {
        if (ag.data_atendimento) {
            (byDate[ag.data_atendimento] ??= []).push(ag);
        }
    }

    const today = startOfDay(new Date());

    return (
        <div className="flex-1 overflow-auto">
            {/* Header dias */}
            <div className="grid grid-cols-7 border-b border-slate-800 sticky top-0 bg-slate-950 z-10">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                    <div key={d} className="py-2.5 text-center text-xs font-medium text-slate-500">{d}</div>
                ))}
            </div>
            {/* Semanas */}
            {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 border-b border-slate-800/50 min-h-[100px]">
                    {week.map((d, di) => {
                        const key = format(d, "yyyy-MM-dd");
                        const dayAgs = byDate[key] ?? [];
                        const isToday = isSameDay(d, today);
                        const isCurrentMonth = isSameMonth(d, currentDate);
                        return (
                            <div key={di} className={`p-1.5 border-r border-slate-800/50 last:border-r-0 ${!isCurrentMonth ? "opacity-30" : ""}`}>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mb-1 font-medium ${isToday ? "bg-blue-500 text-white" : "text-slate-300"}`}>
                                    {format(d, "d")}
                                </div>
                                <div className="space-y-0.5">
                                    {dayAgs.slice(0, 3).map((ag) => (
                                        <button
                                            key={ag.id}
                                            onClick={() => onSelect(ag)}
                                            className={`w-full text-left text-xs px-1.5 py-0.5 rounded truncate border ${statusColor(ag.status)} hover:opacity-80 transition-opacity`}
                                        >
                                            {formatHorario(ag.horario)} {ag.paciente_nome ?? ag.paciente_cpf}
                                        </button>
                                    ))}
                                    {dayAgs.length > 3 && (
                                        <p className="text-xs text-slate-500 pl-1">+{dayAgs.length - 3} mais</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

// ─── Visualização Semana ───────────────────────────────────────────────────────

function WeekView({ currentDate, agendamentos, onSelect }: { currentDate: Date; agendamentos: Agendamento[]; onSelect: (a: Agendamento) => void }) {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const today = startOfDay(new Date());

    const byDate: Record<string, Agendamento[]> = {};
    for (const ag of agendamentos) {
        if (ag.data_atendimento) {
            (byDate[ag.data_atendimento] ??= []).push(ag);
        }
    }

    return (
        <div className="flex-1 overflow-auto">
            {/* header */}
            <div className="grid grid-cols-8 border-b border-slate-800 sticky top-0 bg-slate-950 z-10">
                <div className="py-2.5" />
                {days.map((d, i) => (
                    <div key={i} className="py-2.5 text-center border-l border-slate-800">
                        <div className="text-xs text-slate-500">{format(d, "EEE", { locale: ptBR })}</div>
                        <div className={`text-sm font-semibold mx-auto w-7 h-7 rounded-full flex items-center justify-center ${isSameDay(d, today) ? "bg-blue-500 text-white" : "text-white"}`}>
                            {format(d, "d")}
                        </div>
                    </div>
                ))}
            </div>
            {/* time slots */}
            {HOURS.map((hour) => (
                <div key={hour} className="grid grid-cols-8 border-b border-slate-800/40 min-h-[56px]">
                    <div className="py-1 pr-3 text-right text-xs text-slate-600 pt-2">{String(hour).padStart(2, "0")}:00</div>
                    {days.map((d, di) => {
                        const key = format(d, "yyyy-MM-dd");
                        const ags = (byDate[key] ?? []).filter((a) => {
                            const h = parseInt(a.horario?.slice(0, 2) ?? "0");
                            return h === hour;
                        });
                        return (
                            <div key={di} className="border-l border-slate-800/40 p-0.5 space-y-0.5">
                                {ags.map((ag) => (
                                    <button
                                        key={ag.id}
                                        onClick={() => onSelect(ag)}
                                        className={`w-full text-left text-xs px-1.5 py-1 rounded border ${statusColor(ag.status)} hover:opacity-80 transition-opacity`}
                                    >
                                        <div className="font-medium">{formatHorario(ag.horario)}</div>
                                        <div className="truncate opacity-80">{ag.paciente_nome ?? ag.paciente_cpf}</div>
                                    </button>
                                ))}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

// ─── Visualização Dia ──────────────────────────────────────────────────────────

function DayView({ currentDate, agendamentos, onSelect }: { currentDate: Date; agendamentos: Agendamento[]; onSelect: (a: Agendamento) => void }) {
    const key = format(currentDate, "yyyy-MM-dd");
    const dayAgs = agendamentos.filter((a) => a.data_atendimento === key);

    return (
        <div className="flex-1 overflow-auto">
            {HOURS.map((hour) => {
                const ags = dayAgs.filter((a) => parseInt(a.horario?.slice(0, 2) ?? "0") === hour);
                return (
                    <div key={hour} className="flex gap-4 border-b border-slate-800/40 min-h-[64px] p-3">
                        <div className="text-xs text-slate-600 w-12 shrink-0 pt-1">{String(hour).padStart(2, "0")}:00</div>
                        <div className="flex-1 space-y-1.5">
                            {ags.map((ag) => (
                                <button
                                    key={ag.id}
                                    onClick={() => onSelect(ag)}
                                    className={`w-full text-left px-3 py-2 rounded-lg border ${statusColor(ag.status)} hover:opacity-80 transition-opacity`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Clock3 className="w-3.5 h-3.5 shrink-0" />
                                        <span className="text-xs font-medium">{formatHorario(ag.horario)}</span>
                                        <span className="text-xs opacity-70">|</span>
                                        <span className="text-xs font-semibold">{ag.paciente_nome ?? ag.paciente_cpf}</span>
                                    </div>
                                    <div className="text-xs opacity-60 mt-0.5 ml-5">
                                        {ag.profissional_nome} • {ag.tipo_atendimento_nome}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Visualização Lista ────────────────────────────────────────────────────────

function ListView({ agendamentos, onSelect }: { agendamentos: Agendamento[]; onSelect: (a: Agendamento) => void }) {
    if (agendamentos.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <Calendar className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Nenhum agendamento neste período</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto p-4">
            <div className="space-y-2">
                {agendamentos.map((ag) => (
                    <button
                        key={ag.id}
                        onClick={() => onSelect(ag)}
                        className="w-full text-left bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 hover:bg-slate-800/50 transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            {/* Data */}
                            <div className="w-12 text-center shrink-0">
                                <div className="text-lg font-bold text-white leading-none">
                                    {ag.data_atendimento ? format(parseISO(ag.data_atendimento), "dd") : "—"}
                                </div>
                                <div className="text-xs text-slate-500 uppercase">
                                    {ag.data_atendimento ? format(parseISO(ag.data_atendimento), "MMM", { locale: ptBR }) : ""}
                                </div>
                            </div>
                            <div className="w-px h-10 bg-slate-700 shrink-0" />
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-sm font-semibold text-white truncate">{ag.paciente_nome ?? ag.paciente_cpf ?? "—"}</span>
                                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${statusColor(ag.status)}`}>
                                        {ag.status}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-400">
                                    <span className="flex items-center gap-1">
                                        <Clock3 className="w-3 h-3" />{formatHorario(ag.horario)}
                                    </span>
                                    {ag.profissional_nome && <span>• {ag.profissional_nome}</span>}
                                    {ag.tipo_atendimento_nome && <span>• {ag.tipo_atendimento_nome}</span>}
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 shrink-0" />
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─── Page Principal ────────────────────────────────────────────────────────────

export default function AgendamentosPage() {
    const [view, setView] = useState<ViewMode>("month");
    const [currentDate, setCurrentDate] = useState(new Date());
    const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Agendamento | null>(null);

    // O mês a ser buscado depende da view e da data atual
    const fetchMonth = format(currentDate, "yyyy-MM");

    const fetchAgendamentos = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/agendamentos?month=${fetchMonth}`);
            const data = await res.json();
            setAgendamentos(data.agendamentos ?? []);
        } catch (err) {
            console.error("Erro ao buscar agendamentos:", err);
        } finally {
            setLoading(false);
        }
    }, [fetchMonth]);

    useEffect(() => {
        fetchAgendamentos();
    }, [fetchAgendamentos]);

    // Navegação
    function navigate(direction: "prev" | "next") {
        setCurrentDate((d) => {
            if (view === "month") return direction === "prev" ? subMonths(d, 1) : addMonths(d, 1);
            if (view === "week")  return direction === "prev" ? subWeeks(d, 1) : addWeeks(d, 1);
            return direction === "prev" ? addDaysAlias(d, -1) : addDaysAlias(d, 1);
        });
    }

    function periodLabel(): string {
        if (view === "month") return format(currentDate, "MMMM yyyy", { locale: ptBR });
        if (view === "week") {
            const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
            const we = endOfWeek(currentDate, { weekStartsOn: 0 });
            return `${format(ws, "dd MMM", { locale: ptBR })} – ${format(we, "dd MMM yyyy", { locale: ptBR })}`;
        }
        return format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    }

    const views: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
        { id: "month", icon: <CalendarDays className="w-4 h-4" />, label: "Mês" },
        { id: "week",  icon: <CalendarCheck className="w-4 h-4" />, label: "Semana" },
        { id: "day",   icon: <Clock3 className="w-4 h-4" />, label: "Dia" },
        { id: "list",  icon: <List className="w-4 h-4" />, label: "Lista" },
    ];

    return (
        <div className="flex flex-col h-full bg-slate-950">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-3 mr-auto">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shrink-0">
                        <CalendarDays className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white">Agendamentos</h1>
                        <p className="text-xs text-slate-400">Agendados pela IA</p>
                    </div>
                </div>

                {/* Navegação */}
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate("prev")} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setCurrentDate(new Date())}
                        className="px-3 py-1.5 text-xs rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                        Hoje
                    </button>
                    <button onClick={() => navigate("next")} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                    <span className="text-sm font-medium text-white capitalize ml-1">{periodLabel()}</span>
                </div>

                {/* Seletor de view */}
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 gap-0.5">
                    {views.map(({ id, icon, label }) => (
                        <button
                            key={id}
                            onClick={() => setView(id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view === id ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}
                        >
                            {icon}{label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Conteúdo */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex items-center gap-3 text-slate-400">
                        <span className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                        <span className="text-sm">Carregando agendamentos...</span>
                    </div>
                </div>
            ) : (
                <>
                    {view === "month" && <MonthView currentDate={currentDate} agendamentos={agendamentos} onSelect={setSelected} />}
                    {view === "week"  && <WeekView  currentDate={currentDate} agendamentos={agendamentos} onSelect={setSelected} />}
                    {view === "day"   && <DayView   currentDate={currentDate} agendamentos={agendamentos} onSelect={setSelected} />}
                    {view === "list"  && <ListView  agendamentos={agendamentos} onSelect={setSelected} />}
                </>
            )}

            {/* Modal */}
            {selected && <DetailModal ag={selected} onClose={() => setSelected(null)} />}
        </div>
    );
}
