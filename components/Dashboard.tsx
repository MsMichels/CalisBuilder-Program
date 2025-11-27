
import React from 'react';
import { Trophy, TrendingUp, History, Play, Dumbbell, BrainCircuit, Coffee, Calendar, CheckCircle2, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from 'recharts';
import { Button } from './Button';
import { UserProfile, WorkoutRoutine, WorkoutSession, ScheduleEntry } from '../types';
import { getTodayString } from '../utils/scheduler';

export const Dashboard = ({ 
    profile, 
    history, 
    routines, 
    schedule,
    onStartWorkout,
    onCreateRoutine
}: { 
    profile: UserProfile, 
    history: WorkoutSession[], 
    routines: WorkoutRoutine[], 
    schedule: ScheduleEntry[],
    onStartWorkout: (r: WorkoutRoutine) => void,
    onCreateRoutine: () => void
}) => {
    const today = getTodayString();
    const todayEntry = schedule.find(s => s.date === today);
    
    // Encontrar o próximo treino válido (seja hoje ou futuro)
    const nextWorkoutEntry = schedule.find(s => s.date >= today && s.type === 'workout' && !s.completed);
    const nextRoutine = routines.find(r => r.id === nextWorkoutEntry?.routineId);
    const todayRoutine = routines.find(r => r.id === todayEntry?.routineId);

    const calculateVolume = (session: WorkoutSession) => {
        let vol = 0;
        Object.values(session.logs).forEach(logs => logs.forEach(l => vol += l.reps));
        return vol;
    };

    const chartData = history.map((h) => ({
        name: new Date(h.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit'}),
        reps: calculateVolume(h),
    })).slice(-10);

    const isRestDay = todayEntry?.type === 'rest';
    const isCompleted = todayEntry?.completed;
    const isWorkoutDay = todayEntry?.type === 'workout' && !isCompleted;

    const renderHeroSection = () => {
        if (routines.length === 0) {
            return (
                <div className="bg-slate-800 p-8 rounded-2xl border border-dashed border-slate-600 text-center animate-in zoom-in-95 duration-300">
                    <div className="bg-slate-700 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Dumbbell className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Sem plano ativo</h3>
                    <p className="text-slate-400 mb-6 max-w-sm mx-auto">Crie uma rotina personalizada com nossa IA para começar sua jornada na calistenia.</p>
                    <Button onClick={onCreateRoutine} className="mx-auto shadow-xl shadow-emerald-500/10"><BrainCircuit size={18} /> Criar Rotina Agora</Button>
                </div>
            );
        }

        if (isCompleted) {
            return (
                <div className="bg-gradient-to-br from-emerald-900/50 to-slate-900 p-8 rounded-2xl border border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4 duration-500">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
                            <CheckCircle2 size={12} /> Missão Cumprida
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-2">Treino de hoje finalizado!</h2>
                        <p className="text-slate-400">Bom trabalho, {profile.name}. Descanse e prepare-se para o próximo.</p>
                    </div>
                    <div className="bg-emerald-500/10 p-6 rounded-full">
                        <Trophy size={48} className="text-emerald-500" />
                    </div>
                </div>
            );
        }

        if (isRestDay) {
            return (
                <div className="bg-gradient-to-br from-blue-900/40 to-slate-900 p-8 rounded-2xl border border-blue-500/20 flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4 duration-500">
                    <div className="flex-1">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider mb-3">
                            <Coffee size={12} /> Dia de Descanso
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-2">Recuperação Ativa</h2>
                        <p className="text-slate-400 mb-6">Hoje não há treinos programados. A recuperação é essencial para hipertrofia.</p>
                        
                        {nextRoutine && (
                             <div className="flex items-center gap-4">
                                <div className="text-sm text-slate-500">Próximo: <strong className="text-slate-300">{nextRoutine.name}</strong></div>
                                <button 
                                    onClick={() => onStartWorkout(nextRoutine)} 
                                    className="text-xs text-blue-400 hover:text-white hover:underline flex items-center gap-1"
                                >
                                    Antecipar Treino <ChevronRight size={12}/>
                                </button>
                             </div>
                        )}
                    </div>
                    <div className="opacity-80">
                         <Coffee size={64} className="text-blue-400/50" />
                    </div>
                </div>
            );
        }

        // Workout Day
        return (
            <div className="relative overflow-hidden bg-emerald-600 p-8 rounded-2xl shadow-2xl shadow-emerald-900/50 group cursor-pointer transition-transform hover:scale-[1.01]" onClick={() => todayRoutine && onStartWorkout(todayRoutine)}>
                <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider mb-3 backdrop-blur-sm">
                            <Calendar size={12} /> Treino de Hoje
                        </div>
                        <h2 className="text-4xl font-extrabold text-white mb-2">{todayRoutine?.name}</h2>
                        <div className="flex items-center gap-4 text-emerald-100 text-sm">
                            <span className="flex items-center gap-1"><Dumbbell size={14}/> {todayRoutine?.exercises.length} Exercícios</span>
                            <span className="flex items-center gap-1">~{Math.round((todayRoutine?.exercises.reduce((acc, ex) => acc + (ex.targetSets * (ex.restSeconds + 45)), 0) || 0) / 60)} min</span>
                        </div>
                    </div>
                    
                    <button className="bg-white text-emerald-600 hover:bg-emerald-50 px-8 py-4 rounded-xl font-bold text-lg shadow-lg flex items-center gap-2 transition-all group-hover:gap-4">
                        <Play fill="currentColor" size={20} /> INICIAR
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-1">Olá, {profile.name} 👋</h1>
                    <p className="text-slate-400 text-sm">Vamos construir força hoje.</p>
                </div>
            </header>

            {/* Hero Section - The Main Action */}
            {renderHeroSection()}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/50 hover:border-slate-600 transition-colors">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><History size={18}/></div>
                        <span className="text-slate-400 text-xs font-bold uppercase">Treinos</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{history.length}</div>
                </div>
                
                <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/50 hover:border-slate-600 transition-colors">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400"><TrendingUp size={18}/></div>
                        <span className="text-slate-400 text-xs font-bold uppercase">Nível</span>
                    </div>
                    <div className="text-xl font-bold text-white truncate">{profile.level}</div>
                </div>

                 <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/50 col-span-2 hover:border-slate-600 transition-colors">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><Trophy size={18}/></div>
                        <span className="text-slate-400 text-xs font-bold uppercase">Objetivo Atual</span>
                    </div>
                    <div className="text-xl font-bold text-white">{profile.goal}</div>
                </div>
            </div>

            {/* Chart Section */}
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white">Consistência (Reps Totais)</h3>
                </div>
                <div className="h-64 w-full relative min-w-0">
                    {history.length > 0 ? (
                        <div className="absolute inset-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorReps" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }} 
                                        itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                                        cursor={{ stroke: '#334155', strokeWidth: 1 }}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="reps" 
                                        stroke="#10b981" 
                                        strokeWidth={3} 
                                        dot={{ fill: '#0f172a', stroke: '#10b981', strokeWidth: 2, r: 4 }} 
                                        activeDot={{ r: 6, fill: '#10b981' }} 
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 border border-dashed border-slate-700 rounded-xl bg-slate-800/50">
                            <TrendingUp size={32} className="opacity-50" />
                            <p>Complete treinos para gerar dados.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
