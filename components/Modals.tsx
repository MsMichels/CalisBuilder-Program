
import React, { useState, useEffect } from 'react';
import { BrainCircuit, Layers, Pencil, X, Trash2, Plus, ArrowRight, Calendar, Clock, Dumbbell, Trophy } from 'lucide-react';
import { Button } from './Button';
import { UserProfile, WorkoutRoutine, WorkoutSession, SetLog, Exercise, Goal } from '../types';
import * as GeminiService from '../services/geminiService';
import { normalizeDate } from '../utils/scheduler';

export const RoutineCreator = ({ profile, onSave, onCancel }: { profile: UserProfile, onSave: (r: WorkoutRoutine[]) => void, onCancel: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [splitType, setSplitType] = useState('full_body');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const routines = await GeminiService.generateRoutine(profile, splitType);
      onSave(routines);
    } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg || 'Falha ao gerar rotina. Verifique conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700 shadow-2xl">
        <h2 className="text-2xl font-bold text-emerald-400 mb-4 flex items-center gap-2"><BrainCircuit size={24} /> Treinador IA</h2>
        <div className="mb-6 space-y-2">
            <label className="text-sm font-medium text-slate-400 flex items-center gap-2"><Layers size={16} /> Divisão</label>
            <select value={splitType} onChange={(e) => setSplitType(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none">
                <option value="full_body">Full Body (1 Rotina)</option>
                <option value="upper_lower">Upper / Lower (2 Rotinas)</option>
                <option value="upper_lower_abcd">ABCD (4 Rotinas)</option>
                <option value="ppl">Push / Pull / Legs (3 Rotinas)</option>
            </select>
        </div>
        {error && <div className="text-red-400 text-sm mb-4">{error}</div>}
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button onClick={handleGenerate} isLoading={loading}>Gerar Plano</Button>
        </div>
      </div>
    </div>
  );
};

export const RoutineEditor = ({ routine, onSave, onCancel }: { routine: WorkoutRoutine, onSave: (r: WorkoutRoutine) => void, onCancel: () => void }) => {
    const [editedRoutine, setEditedRoutine] = useState<WorkoutRoutine>(JSON.parse(JSON.stringify(routine)));

    const handleExerciseChange = (index: number, field: keyof Exercise, value: any) => {
        const updated = [...editedRoutine.exercises];
        updated[index] = { ...updated[index], [field]: value };
        setEditedRoutine({ ...editedRoutine, exercises: updated });
    };

    const addExercise = () => {
        setEditedRoutine({ ...editedRoutine, exercises: [...editedRoutine.exercises, {
            id: crypto.randomUUID(), name: 'Novo Exercício', muscleGroup: 'Geral', targetSets: 3, targetReps: '15', restSeconds: 60
        }]});
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-slate-800 rounded-2xl w-full max-w-2xl border border-slate-700 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2"><Pencil size={20}/> Editar Treino</h2>
                    <button onClick={onCancel}><X size={24}/></button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nome</label>
                        <input value={editedRoutine.name} onChange={e => setEditedRoutine({...editedRoutine, name: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white font-bold text-lg" />
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <label className="text-xs font-bold text-slate-500 uppercase">Exercícios</label>
                            <Button variant="secondary" onClick={addExercise} className="py-1 px-3 text-xs"><Plus size={14}/> Add</Button>
                        </div>
                        <div className="space-y-4">
                            {editedRoutine.exercises.map((ex, i) => (
                                <div key={ex.id} className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex flex-col gap-3 relative">
                                    <button onClick={() => setEditedRoutine({...editedRoutine, exercises: editedRoutine.exercises.filter((_, idx) => idx !== i)})} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 p-2"><Trash2 size={16}/></button>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-8">
                                        <input value={ex.name} onChange={e => handleExerciseChange(i, 'name', e.target.value)} className="bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm" placeholder="Nome" />
                                        <input value={ex.muscleGroup} onChange={e => handleExerciseChange(i, 'muscleGroup', e.target.value)} className="bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm" placeholder="Músculo" />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <input type="number" value={ex.targetSets} onChange={e => handleExerciseChange(i, 'targetSets', parseInt(e.target.value))} className="bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm" placeholder="Séries" />
                                        <input value={ex.targetReps} onChange={e => handleExerciseChange(i, 'targetReps', e.target.value)} className="bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm" placeholder="Reps" />
                                        <input type="number" value={ex.restSeconds} onChange={e => handleExerciseChange(i, 'restSeconds', parseInt(e.target.value))} className="bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm" placeholder="Descanso" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="p-6 border-t border-slate-700 flex justify-end gap-3 bg-slate-800 rounded-b-2xl">
                    <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
                    <Button onClick={() => onSave(editedRoutine)}>Salvar</Button>
                </div>
            </div>
        </div>
    );
};

export const SessionEditor = ({ session, routines, onSave, onCancel }: { session: WorkoutSession, routines: WorkoutRoutine[], onSave: (s: WorkoutSession) => void, onCancel: () => void }) => {
    const initialDateVal = normalizeDate(session.date); 
    
    const [editedSession, setEditedSession] = useState<WorkoutSession>(JSON.parse(JSON.stringify(session)));
    const [dateInput, setDateInput] = useState(initialDateVal);

    const handleSave = () => {
        const [y, m, d] = dateInput.split('-').map(Number);
        const safeDate = new Date(y, m - 1, d, 12, 0, 0);
        
        onSave({
            ...editedSession,
            date: safeDate.toISOString()
        });
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
             <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 p-6 space-y-4">
                <h3 className="text-xl font-bold text-white">Editar Registro</h3>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Treino</label>
                    <select value={editedSession.routineId} onChange={(e) => setEditedSession({...editedSession, routineId: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white">
                        {routines.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Data</label>
                    <input 
                        type="date" 
                        value={dateInput}
                        onChange={(e) => setDateInput(e.target.value)} 
                        className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white" 
                    />
                </div>
                <div className="flex gap-3 justify-end pt-4">
                    <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
                    <Button onClick={handleSave}>Salvar</Button>
                </div>
             </div>
        </div>
    );
};

export const ManualLogModal = ({ date, routines, onSave, onCancel }: { date: string, routines: WorkoutRoutine[], onSave: (session: WorkoutSession) => void, onCancel: () => void }) => {
    const [selectedRoutineId, setSelectedRoutineId] = useState(routines[0]?.id || '');
    const [step, setStep] = useState(1);
    const [notes, setNotes] = useState('');
    const [logs, setLogs] = useState<Record<string, SetLog[]>>({});
    const selectedRoutine = routines.find(r => r.id === selectedRoutineId);

    const initializeLogs = () => {
        if (!selectedRoutine) return;
        const initialLogs: Record<string, SetLog[]> = {};
        selectedRoutine.exercises.forEach(ex => { initialLogs[ex.id] = Array(ex.targetSets).fill({ reps: 0 }); });
        setLogs(initialLogs);
        setStep(2);
    };

    const handleConfirm = () => {
        const cleanLogs: Record<string, SetLog[]> = {};
        Object.keys(logs).forEach(key => {
            const validSets = logs[key].filter(s => s.reps > 0);
            if (validSets.length > 0) cleanLogs[key] = validSets;
        });

        const [y, m, d] = date.split('-').map(Number);
        const safeDate = new Date(y, m - 1, d, 12, 0, 0);

        onSave({ 
            id: crypto.randomUUID(), 
            routineId: selectedRoutineId, 
            date: safeDate.toISOString(), 
            durationSeconds: 0, 
            logs: cleanLogs, 
            notes: notes || 'Manual' 
        });
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-slate-800 rounded-2xl w-full max-w-lg border border-slate-700 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-700"><h3 className="text-xl font-bold text-white">Registro Manual - {date.split('-').reverse().join('/')}</h3></div>
                <div className="p-6 overflow-y-auto flex-1">
                    {step === 1 ? (
                        <select value={selectedRoutineId} onChange={(e) => setSelectedRoutineId(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white">
                            {routines.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    ) : (
                        <div className="space-y-6">
                            {selectedRoutine?.exercises.map((ex) => (
                                <div key={ex.id} className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                                    <h4 className="font-bold text-white text-sm mb-2">{ex.name}</h4>
                                    <div className="space-y-2">
                                        {logs[ex.id]?.map((log, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <span className="text-xs text-slate-500 w-6">#{idx+1}</span>
                                                <input type="number" value={log.reps || ''} onChange={(e) => setLogs(p => { const arr = [...(p[ex.id]||[])]; arr[idx] = {reps: parseInt(e.target.value)||0}; return {...p, [ex.id]: arr};})} className="flex-1 bg-slate-800 border border-slate-600 rounded p-2 text-white text-center" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-6 border-t border-slate-700 flex gap-3 justify-end">
                    <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
                    {step === 1 ? <Button onClick={initializeLogs}>Próximo <ArrowRight size={16}/></Button> : <Button onClick={handleConfirm}>Salvar</Button>}
                </div>
            </div>
        </div>
    );
};

export const ProgressionModal = ({ currentExercise, goal, onSelect, onCancel }: { currentExercise: Exercise, goal: Goal, onSelect: (newEx: Exercise) => void, onCancel: () => void }) => {
    const [variations, setVariations] = useState<Exercise[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        GeminiService.getExerciseVariations(currentExercise, goal).then(setVariations).finally(() => setLoading(false));
    }, [currentExercise, goal]);

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-slate-800 rounded-2xl p-6 max-w-lg w-full border border-slate-700">
                <h3 className="text-xl font-bold text-white mb-2">Evoluir: {currentExercise.name}</h3>
                {loading ? <div className="py-10 text-center text-emerald-500">Analisando...</div> : (
                    <div className="space-y-3">
                        {variations.map(v => (
                            <div key={v.id} className="bg-slate-900 p-4 rounded-xl border border-slate-700 hover:border-emerald-500 cursor-pointer" onClick={() => onSelect(v)}>
                                <h4 className="font-bold text-white">{v.name}</h4>
                                <p className="text-slate-400 text-sm">{v.description}</p>
                            </div>
                        ))}
                    </div>
                )}
                <Button variant="ghost" onClick={onCancel} className="mt-4 w-full">Cancelar</Button>
            </div>
        </div>
    );
};

export const SessionDetailsModal = ({ session, routines, onClose, onDelete }: { session: WorkoutSession, routines: WorkoutRoutine[], onClose: () => void, onDelete: (id: string) => void }) => {
    const routine = routines.find(r => r.id === session.routineId);
    
    // Sort logs based on routine order if available, otherwise just use keys
    const exerciseIds = routine ? routine.exercises.map(e => e.id) : Object.keys(session.logs);

    const handleDelete = () => {
        if (confirm('Tem certeza que deseja excluir este registro de treino? Esta ação não pode ser desfeita.')) {
            onDelete(session.id);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-in fade-in">
            <div className="bg-slate-900 rounded-2xl w-full max-w-2xl border border-slate-800 flex flex-col max-h-[90vh] shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-900 rounded-t-2xl">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider">Concluído</span>
                            <span className="text-slate-500 text-sm flex items-center gap-1"><Calendar size={12}/> {new Date(session.date).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <h2 className="text-2xl font-bold text-white">{routine?.name || 'Treino (Desconhecido)'}</h2>
                        {session.durationSeconds > 0 && (
                            <div className="flex items-center gap-4 mt-2 text-slate-400 text-sm">
                                <span className="flex items-center gap-1"><Clock size={14}/> {Math.floor(session.durationSeconds / 60)} min</span>
                                <span className="flex items-center gap-1"><Trophy size={14}/> {Object.values(session.logs).flat().reduce((acc, l) => acc + l.reps, 0)} reps totais</span>
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 p-2 rounded-full transition-colors"><X size={20} className="text-slate-400 hover:text-white"/></button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {exerciseIds.map(exId => {
                        const logs = session.logs[exId];
                        if (!logs || logs.length === 0) return null;
                        
                        // Try to find exercise name from routine, or fallback to generic
                        const exerciseName = routine?.exercises.find(e => e.id === exId)?.name || 'Exercício';
                        const muscle = routine?.exercises.find(e => e.id === exId)?.muscleGroup;

                        return (
                            <div key={exId} className="space-y-2">
                                <div className="flex justify-between items-end border-b border-slate-800 pb-1">
                                    <h3 className="text-lg font-bold text-slate-200">{exerciseName}</h3>
                                    {muscle && <span className="text-xs text-slate-500 uppercase">{muscle}</span>}
                                </div>
                                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                    {logs.map((log, idx) => (
                                        <div key={idx} className="bg-slate-800 border border-slate-700 rounded-lg p-2 flex flex-col items-center">
                                            <span className="text-[10px] text-slate-500 uppercase font-bold">Set {idx + 1}</span>
                                            <span className="text-lg font-bold text-emerald-400">{log.reps}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-800 bg-slate-900 rounded-b-2xl flex justify-between items-center">
                     <button 
                        onClick={handleDelete}
                        className="flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                    >
                        <Trash2 size={16} /> Excluir Registro
                    </button>
                    <Button onClick={onClose}>Fechar</Button>
                </div>
            </div>
        </div>
    );
};
