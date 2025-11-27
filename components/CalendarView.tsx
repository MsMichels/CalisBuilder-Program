
import React from 'react';
import { CheckCircle2, RefreshCcw, PlusCircle, Calendar as CalendarIcon, Dumbbell, Coffee } from 'lucide-react';
import { ScheduleEntry, WorkoutRoutine, WorkoutSession } from '../types';
import { getTodayString, normalizeDate, generateCalendarDays } from '../utils/scheduler';

export const CalendarView = ({ 
    schedule, 
    routines, 
    history,
    onUpdateSchedule,
    onManualLog,
    onDeleteSession,
    onViewSession
}: { 
    schedule: ScheduleEntry[], 
    routines: WorkoutRoutine[], 
    history: WorkoutSession[],
    onUpdateSchedule: (newSchedule: ScheduleEntry[]) => void,
    onManualLog: (date: string) => void,
    onDeleteSession: (sessionId: string) => void,
    onViewSession: (session: WorkoutSession) => void
}) => {
    const today = getTodayString();
    
    // Utiliza a função do scheduler para gerar datas consistentes
    const days = generateCalendarDays(35);

    const toggleDay = (dateStr: string) => {
        if (dateStr > today) {
            // Future: Toggle Type
            const entry = schedule.find(s => s.date === dateStr);
            const newSchedule = schedule.filter(s => s.date !== dateStr);
            if (entry?.type === 'workout') {
                newSchedule.push({ date: dateStr, type: 'rest' });
            } else {
                newSchedule.push({ date: dateStr, type: 'workout', routineId: routines[0]?.id });
            }
            // Sort to keep order
            newSchedule.sort((a,b) => a.date.localeCompare(b.date));
            onUpdateSchedule(newSchedule);
        } else {
            // Past/Present
            // Busca treino usando normalizeDate para garantir match de fuso horário exato
            const session = history.find(h => normalizeDate(h.date) === dateStr);
            
            if (session) {
                // Abre o modal de detalhes em vez de tentar deletar diretamente
                onViewSession(session);
            } else {
                onManualLog(dateStr);
            }
        }
    };

    const getRoutineName = (id?: string) => {
        const name = routines.find(r => r.id === id)?.name || '?';
        return name.split(' ')[0] + (name.split(' ')[1] ? ' ' + name.split(' ')[1].substring(0,1) : ''); // Abbreviate
    };

    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-800 pb-6">
                <div>
                    <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                        <CalendarIcon className="text-emerald-500" /> Agenda
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">Gerencie seus treinos passados e planeje o futuro.</p>
                </div>
                
                {/* Legend */}
                <div className="flex flex-wrap gap-4 text-xs font-medium bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-2 text-slate-300">
                        <div className="w-3 h-3 rounded bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-sm"></div> 
                        Concluído
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                        <div className="w-3 h-3 rounded bg-slate-800 border border-emerald-500/50"></div> 
                        Planejado
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                        <div className="w-3 h-3 rounded bg-slate-900 border border-slate-800 border-dashed"></div> 
                        Descanso
                    </div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-slate-900/50 p-4 rounded-3xl border border-slate-800 shadow-2xl">
                {/* Days Header */}
                <div className="grid grid-cols-7 mb-4">
                    {weekDays.map(day => (
                        <div key={day} className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider py-2">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-2 md:gap-3">
                    {days.map(dateStr => {
                        const entry = schedule.find(s => s.date === dateStr);
                        const isToday = dateStr === today;
                        const isPast = dateStr < today;
                        const isWorkout = entry?.type === 'workout';
                        const isCompleted = history.some(h => normalizeDate(h.date) === dateStr);
                        const dayNumber = parseInt(dateStr.split('-')[2]);

                        const isRest = !isWorkout;
                        const borderClass = isCompleted ? 'border-emerald-500' : isWorkout ? 'border-emerald-500/30' : 'border-slate-700/30 border-dashed';
                        const bgClass = isCompleted ? 'bg-emerald-700/10' : (isWorkout ? 'bg-emerald-600/4' : 'bg-slate-900/28');
                        const statusDot = isCompleted ? 'bg-emerald-400' : (isWorkout ? (isPast ? 'bg-red-400' : 'bg-emerald-400/80') : 'bg-slate-600');
                        const todayClass = isToday ? 'ring-2 ring-emerald-400 scale-[1.02]' : '';

                        return (
                            <div
                                key={dateStr}
                                onClick={() => toggleDay(dateStr)}
                                className={`relative min-h-[86px] p-3 rounded-xl border ${borderClass} ${bgClass} transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden ${todayClass}`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-lg md:text-xl font-extrabold tracking-tight ${isToday ? 'text-white' : 'text-slate-200'}`}>{dayNumber}</span>
                                        {isToday && <span className="text-[11px] md:text-[12px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-semibold">Hoje</span>}
                                    </div>
                                    <div className={`w-3 h-3 rounded-full ${statusDot} shrink-0`} />
                                </div>

                                <div className="mt-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            {isWorkout ? (
                                                <div className="text-sm md:text-base font-medium text-slate-200 truncate">{getRoutineName(entry?.routineId)}</div>
                                            ) : (
                                                <div className="text-xs md:text-sm text-slate-400 uppercase tracking-wide font-medium">Descanso</div>
                                            )}
                                        </div>
                                        <div className="ml-2">
                                            {/* Day type pill */}
                                            {isWorkout ? (
                                                <div className="text-[11px] md:text-xs font-bold text-emerald-600 bg-emerald-600/10 px-2 py-0.5 rounded-full">TREINO</div>
                                            ) : (
                                                <div className="text-[10px] md:text-[11px] font-medium text-slate-400 bg-slate-800/20 px-2 py-0.5 rounded-full">DESCANSO</div>
                                            )}
                                        </div>
                                    </div>

                                    {isPast && !isCompleted && isWorkout && <div className="text-[11px] text-red-400 mt-1">Não realizado</div>}
                                    {isCompleted && <div className="text-[11px] text-emerald-300 mt-1">Concluído</div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Helper Info */}
            <div className="bg-blue-900/20 border border-blue-500/20 p-4 rounded-xl flex gap-3 items-start">
                <RefreshCcw className="text-blue-400 shrink-0 mt-0.5" size={18} />
                <div>
                    <h4 className="text-sm font-bold text-blue-100">Dica de Planejamento</h4>
                    <p className="text-xs text-blue-300/80 mt-1">
                        Clique em dias futuros para alternar entre "Treino" e "Descanso". O sistema ajusta automaticamente os dias seguintes para manter sua frequência ideal.
                    </p>
                </div>
            </div>
        </div>
    );
};
