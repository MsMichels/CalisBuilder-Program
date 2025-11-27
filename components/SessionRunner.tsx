
import React, { useState, useEffect, useRef } from 'react';
import { Timer, X, Play, Pause, ChevronRight, CheckCircle2, Trash2, Plus, RefreshCcw, Info, ChevronLeft, Dumbbell, History } from 'lucide-react';
import { Button } from './Button';
import { WorkoutRoutine, WorkoutSession, UserProfile, SetLog, Exercise } from '../types';
import { ProgressionModal } from './Modals';
import { useAppStore } from '../hooks/useAppStore';

export const SessionRunner = ({ 
  routine, 
  previousSession,
  profile,
  onFinish, 
  onCancel,
  onReplaceExercise
}: { 
  routine: WorkoutRoutine, 
  previousSession?: WorkoutSession,
  profile: UserProfile,
  onFinish: (session: WorkoutSession) => void, 
  onCancel: () => void,
  onReplaceExercise: (oldExId: string, newEx: Exercise) => void
}) => {
  const [logs, setLogs] = useState<Record<string, SetLog[]>>({});
  const [elapsed, setElapsed] = useState(0);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  
  // Timer States
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [isRestPaused, setIsRestPaused] = useState(false);
  const [showProgressionModal, setShowProgressionModal] = useState(false);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isResting && !isRestPaused && restTimer > 0) {
      interval = setInterval(() => {
        setRestTimer(prev => {
          if (prev <= 1) {
            setIsResting(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isResting, isRestPaused, restTimer]);

  // Auto-focus input when changing exercise
  useEffect(() => {
      if (!isResting && inputRef.current) {
          inputRef.current.focus();
      }
  }, [activeExerciseIndex, logs, isResting]);

  // Auto-scroll top navigation to center active exercise
  useEffect(() => {
      if (scrollContainerRef.current) {
          const activeBtn = scrollContainerRef.current.children[activeExerciseIndex] as HTMLElement;
          if (activeBtn) {
              activeBtn.scrollIntoView({ 
                  behavior: 'smooth', 
                  block: 'nearest', 
                  inline: 'center' 
              });
          }
      }
  }, [activeExerciseIndex]);

  // Keyboard Navigation
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (isResting || showProgressionModal) return; // Disable when modal/timer is active
          // Ignore when typing in an input/textarea
          const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
          if (tag === 'input' || tag === 'textarea') return;

          if (e.key === 'ArrowRight') {
              if (activeExerciseIndex < routine.exercises.length - 1) {
                  setActiveExerciseIndex(prev => prev + 1);
              }
          } else if (e.key === 'ArrowLeft') {
              if (activeExerciseIndex > 0) {
                  setActiveExerciseIndex(prev => prev - 1);
              }
          } else if (e.code === 'Space' || e.key === ' ') {
              e.preventDefault();
              // Quick complete set with default reps
              completeSetDefault();
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeExerciseIndex, isResting, showProgressionModal, routine.exercises.length]);

    const { savePartialSession, loadPartialSession, clearPartialSession, partialSyncStatus, commitPartialToHistory } = useAppStore();
    const [draftSavedMsg, setDraftSavedMsg] = useState<string | null>(null);
    // Keep stable refs to store functions to avoid triggering effects repeatedly
    const savePartialRef = useRef(savePartialSession);
    const loadPartialRef = useRef(loadPartialSession);
    const clearPartialRef = useRef(clearPartialSession);
    const commitPartialRef = useRef(commitPartialToHistory);

    useEffect(() => { savePartialRef.current = savePartialSession; }, [savePartialSession]);
    useEffect(() => { loadPartialRef.current = loadPartialSession; }, [loadPartialSession]);
    useEffect(() => { clearPartialRef.current = clearPartialSession; }, [clearPartialSession]);
    useEffect(() => { commitPartialRef.current = commitPartialToHistory; }, [commitPartialToHistory]);

    // Load partial progress (cloud preferred) on mount
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const loader = loadPartialRef.current;
                if (!loader) return;
                const partial = await loader(routine.id);
                if (!mounted) return;
                if (partial) {
                    if (partial.logs) setLogs(partial.logs);
                    if (typeof partial.activeIndex === 'number') setActiveExerciseIndex(partial.activeIndex);
                    if (typeof partial.elapsed === 'number') setElapsed(partial.elapsed);
                }
            } catch (e) { /* ignore */ }
        })();
        return () => { mounted = false; };
    }, [routine.id]);

    // Save partial progress whenever it changes
    useEffect(() => {
        try {
            const saver = savePartialRef.current;
            if (!saver) return;
            // fire-and-forget
            saver(routine.id, { logs, activeIndex: activeExerciseIndex, elapsed }).catch(() => {});
        } catch (e) {}
    }, [logs, activeExerciseIndex, elapsed, routine.id]);


  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const addSet = (exerciseId: string, reps: number) => {
        setLogs(prev => {
            const next = { ...prev, [exerciseId]: [...(prev[exerciseId] || []), { reps }] };
            return next;
        });
        const currentEx = routine.exercises.find(e => e.id === exerciseId);
        if (currentEx) {
            startRest(currentEx.restSeconds);
            // After adding, if completed target sets, auto-advance shortly
            const currentCount = (logs[exerciseId]?.length || 0) + 1;
            if (currentCount >= currentEx.targetSets) {
                setTimeout(() => {
                    // If it's the last exercise, finish workout
                    const idx = routine.exercises.findIndex(x => x.id === exerciseId);
                    if (idx >= 0) {
                        if (idx < routine.exercises.length - 1) {
                            setActiveExerciseIndex(idx + 1);
                        } else {
                            finishWorkout();
                        }
                    }
                }, 700);
            }
        }
  };

    const completeSetDefault = () => {
        if (!currentExercise) return;
        // Use previous set reps if available or parse digits from targetReps
        const prev = currentLogs[currentLogs.length - 1];
        const fallback = parseInt((currentExercise.targetReps || '').toString().replace(/\D/g, '')) || 10;
        const reps = prev?.reps || fallback;
        addSet(currentExercise.id, reps);
    };

  const removeSet = (exerciseId: string, index: number) => {
    setLogs(prev => ({ ...prev, [exerciseId]: (prev[exerciseId] || []).filter((_, i) => i !== index) }));
  };

  const finishWorkout = () => {
        // Clear partial progress in cloud/local before finishing
        try { const clearer = clearPartialRef.current; if (clearer) clearer(routine.id).catch(() => {}); } catch (e) {}
        onFinish({
            id: crypto.randomUUID(),
            routineId: routine.id,
            date: new Date().toISOString(),
            durationSeconds: elapsed,
            logs
        });
  };

  const startRest = (seconds: number) => {
      setRestTimer(seconds);
      setIsResting(true);
      setIsRestPaused(false);
  };

  const toggleManualRest = () => {
      if(isResting) setIsResting(false);
      else startRest(60);
  };

  const currentExercise = routine.exercises[activeExerciseIndex];
  const currentLogs = logs[currentExercise.id] || [];
  const previousLogs = previousSession?.logs[currentExercise.id];
  const lastSetIndex = currentLogs.length; 
  const prevSetData = previousLogs && previousLogs[lastSetIndex] 
    ? previousLogs[lastSetIndex] 
    : (previousLogs && previousLogs.length > 0 ? previousLogs[previousLogs.length - 1] : null);

  const progressPercentage = ((activeExerciseIndex) / routine.exercises.length) * 100;

  return (
    <div className="flex flex-col h-full bg-slate-950 absolute inset-0 z-50 overflow-hidden">
      {/* Immersive Header */}
        <div className="relative bg-gradient-to-b from-slate-900 to-slate-900/90 border-b border-slate-800 z-20">
        <div className="absolute top-0 left-0 h-1 bg-emerald-400 transition-all duration-500" style={{width: `${progressPercentage}%`}} />
        <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-3">
                 <div className="bg-slate-800/60 p-2 rounded-md border border-slate-700">
                    <span className="font-mono text-emerald-400 font-semibold text-lg tracking-wider">{formatTime(elapsed)}</span>
                 </div>
            </div>
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                    {/* Sync badge */}
                    {(() => {
                        const st = partialSyncStatus?.[routine.id] || 'idle';
                        if (st === 'uploading') return <RefreshCcw className="text-slate-300 animate-spin" size={18} />;
                        if (st === 'synced') return <CheckCircle2 className="text-emerald-400" size={18} />;
                        if (st === 'failed') return <X className="text-red-400" size={18} />;
                        return <RefreshCcw className="text-slate-500" size={18} />;
                    })()}
                </div>
                <button onClick={toggleManualRest} aria-label="Descanso" className={`p-2 rounded-full transition-colors ${isResting ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white bg-slate-800'}`}>
                    <Timer size={18} />
                </button>
                <button onClick={onCancel} aria-label="Cancelar" className="p-2 text-slate-400 hover:text-red-400 transition-colors">
                    <X size={20} />
                </button>
            </div>
        </div>
        
        {/* Horizontal Exercise Scroller */}
            <div 
            ref={scrollContainerRef}
            className="flex overflow-x-auto py-2 px-4 gap-2 scrollbar-hide border-t border-slate-800/40 snap-x"
        >
            {routine.exercises.map((ex, idx) => {
                const isActive = idx === activeExerciseIndex;
                const isDone = (logs[ex.id]?.length || 0) >= ex.targetSets;
                return (
                    <button 
                        key={ex.id} 
                        onClick={() => setActiveExerciseIndex(idx)} 
                        className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 snap-center ${
                            isActive 
                            ? 'bg-emerald-500 text-white shadow-md scale-100' 
                            : isDone 
                                ? 'bg-slate-800 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-slate-800 text-slate-500 border border-slate-700 hover:border-slate-600'
                        }`}
                    >
                        {isDone && <CheckCircle2 size={12} />}
                        <span className="max-w-[120px] truncate">{idx + 1}. {ex.name}</span>
                    </button>
                )
            })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
        
        {/* Exercise Header Card */}
        <div className="space-y-2 animate-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-start">
                <h1 className="text-3xl font-bold text-white leading-tight max-w-[80%]">{currentExercise.name}</h1>
                <button onClick={() => setShowInfo(!showInfo)} className={`p-2 rounded-lg ${showInfo ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
                    <Info size={20} />
                </button>
            </div>
            <div className="flex gap-2 text-sm text-slate-400 items-center">
                <span className="bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800 text-xs font-medium uppercase tracking-wide">{currentExercise.muscleGroup}</span>
                {currentExercise.description && showInfo && (
                    <span className="animate-in fade-in text-emerald-400/80 italic text-sm md:text-base">{currentExercise.description}</span>
                )}
            </div>
            
            {/* Target Display */}
            <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center">
                    <span className="text-slate-500 text-xs uppercase font-bold">Meta Séries</span>
                    <span className="text-2xl font-bold text-white">{currentExercise.targetSets}</span>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center">
                    <span className="text-slate-500 text-xs uppercase font-bold">Meta Reps</span>
                    <span className="text-2xl font-bold text-white">{currentExercise.targetReps}</span>
                </div>
            </div>
            {/* Current Exercise Progress */}
            <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">Progresso da série</span>
                    <span className="text-sm font-semibold text-white">{currentLogs.length}/{currentExercise.targetSets}</span>
                </div>
                <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-3 bg-emerald-500 transition-all" style={{ width: `${Math.min(100, Math.round((currentLogs.length / currentExercise.targetSets) * 100))}%` }} />
                </div>
            </div>
        </div>

        {/* Sets List */}
        <div className="space-y-3">
            {/* Completed Sets */}
            {currentLogs.map((log, i) => (
                <div key={i} className="flex items-center justify-between bg-emerald-900/20 border border-emerald-500/20 p-4 rounded-xl animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-4">
                        <div className="bg-emerald-500 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-500/20">
                            {i + 1}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-white font-bold text-lg">{log.reps} <span className="text-sm font-normal text-slate-400">reps</span></span>
                            <span className="text-xs text-emerald-400/70 font-medium">Concluído</span>
                        </div>
                    </div>
                    <button onClick={() => removeSet(currentExercise.id, i)} className="text-slate-600 hover:text-red-400 p-2 transition-colors">
                        <Trash2 size={18} />
                    </button>
                </div>
            ))}

            {/* Current Input Set */}
            <div className="bg-slate-800 border border-slate-700 p-5 rounded-xl shadow-lg relative overflow-hidden group focus-within:border-emerald-500/50 transition-colors">
                <div className="absolute top-0 left-0 w-1 h-full bg-slate-700 group-focus-within:bg-emerald-500 transition-colors" />
                
                <div className="flex justify-between items-center mb-4 pl-2">
                    <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">Série {currentLogs.length + 1}</span>
                    {prevSetData ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 px-2 py-1 rounded-md">
                            <History size={12} />
                            Anterior: <strong className="text-slate-200">{prevSetData.reps}</strong>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                           <Dumbbell size={12} /> Primeira vez
                        </div>
                    )}
                </div>

                <form onSubmit={(e) => {
                       e.preventDefault();
                       const form = e.target as HTMLFormElement;
                       const input = form.elements.namedItem('reps') as HTMLInputElement;
                       const reps = parseInt(input.value);
                       if(!isNaN(reps)) {
                           addSet(currentExercise.id, reps);
                           form.reset();
                       }
                     }} className="flex gap-3 pl-2">
                           <div className="relative flex-1">
                           <input 
                                ref={inputRef}
                                name="reps" 
                                type="number" 
                                inputMode="numeric"
                                placeholder={currentExercise.targetReps.replace(/[^0-9]/g, '') || "15"} 
                                required 
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg py-3 px-4 text-white placeholder-slate-600 focus:border-emerald-500 outline-none text-xl font-bold text-center" 
                           />
                           <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold uppercase pointer-events-none">Reps</span>
                       </div>
                       <div className="flex flex-col gap-2 w-full md:w-auto">
                           <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-4 py-3 flex items-center justify-center shadow-lg active:scale-95 transition-all w-full md:w-auto">
                               <Plus size={18} />
                           </button>
                           <button type="button" onClick={completeSetDefault} className="bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg px-4 py-3 flex items-center gap-2 justify-center shadow-lg active:scale-95 transition-all w-full md:w-auto font-semibold">
                               <CheckCircle2 size={16} />
                               Completar Série
                           </button>
                           <div className="text-xs text-slate-400 mt-1 text-center md:text-left">Atalho: pressione <kbd className="bg-slate-800 px-2 py-0.5 rounded">Space</kbd></div>
                       </div>
                </form>
            </div>
        </div>

        {/* Suggestion / Replace Button */}
        <div className="flex justify-center pt-4">
             <button onClick={() => setShowProgressionModal(true)} className="text-xs text-slate-500 hover:text-emerald-400 flex items-center gap-1.5 transition-colors py-2 px-4 rounded-full hover:bg-slate-800">
                <RefreshCcw size={14} /> 
                Achar exercício muito fácil? Substituir
            </button>
            <div className="ml-3 flex items-center gap-2">
                <button onClick={async () => {
                        const commitFn = commitPartialRef.current;
                        const s = commitFn ? await commitFn(routine.id) : null;
                    if (s) {
                        setDraftSavedMsg('Rascunho salvo no histórico');
                        setTimeout(() => setDraftSavedMsg(null), 2500);
                    }
                }} className="text-xs text-slate-400 hover:text-slate-200 bg-slate-800 px-3 py-2 rounded-md border border-slate-700 transition-colors">
                    Salvar rascunho
                </button>
                {draftSavedMsg && <span className="text-xs text-emerald-400">{draftSavedMsg}</span>}
            </div>
        </div>

      </div>

      {/* Bottom Navigation Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 p-4 pb-safe flex justify-between items-center z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
         <Button 
            variant="ghost" 
            onClick={() => setActiveExerciseIndex(Math.max(0, activeExerciseIndex - 1))} 
            disabled={activeExerciseIndex === 0}
            className="text-slate-400"
         >
            <ChevronLeft size={20} /> Anterior
         </Button>
         
         {activeExerciseIndex < routine.exercises.length - 1 ? (
             <Button onClick={() => setActiveExerciseIndex(activeExerciseIndex + 1)} className="px-6">
                Próximo <ChevronRight size={20} />
             </Button>
         ) : (
             <Button onClick={finishWorkout} className="bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20 px-8 py-3 text-lg">
                Finalizar Treino <CheckCircle2 size={20} className="ml-2" />
             </Button>
         )}
      </div>

      {/* Rest Timer Overlay */}
      {isResting && (
           <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
              <div className="text-center space-y-8 p-8 w-full max-w-md">
                  <div className="flex justify-center mb-8">
                      <div className="bg-emerald-500/10 p-4 rounded-full animate-pulse">
                        <Timer className="text-emerald-400 w-12 h-12" />
                      </div>
                  </div>
                  
                  <div className="space-y-2">
                      <h3 className="text-slate-400 text-sm uppercase tracking-[0.2em] font-bold">Descansando</h3>
                      <div className={`text-8xl font-black font-mono tracking-tighter tabular-nums ${isRestPaused ? 'text-slate-500' : 'text-white'}`}>
                          {formatTime(restTimer)}
                      </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-8">
                      <button onClick={() => setRestTimer(t => Math.max(0, t - 10))} className="flex flex-col items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 p-4 rounded-2xl border border-slate-700 transition-all active:scale-95">
                          <span className="text-xl font-bold text-white">-10</span>
                          <span className="text-xs text-slate-500">segundos</span>
                      </button>
                      
                      <button onClick={() => setIsRestPaused(p => !p)} className={`flex flex-col items-center justify-center gap-1 p-4 rounded-2xl border transition-all active:scale-95 shadow-xl ${isRestPaused ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-slate-800 border-slate-700 text-white'}`}>
                          {isRestPaused ? <Play size={24} fill="currentColor"/> : <Pause size={24} fill="currentColor"/>}
                          <span className="text-xs opacity-80">{isRestPaused ? 'RETOMAR' : 'PAUSAR'}</span>
                      </button>

                      <button onClick={() => setRestTimer(t => t + 30)} className="flex flex-col items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 p-4 rounded-2xl border border-slate-700 transition-all active:scale-95">
                          <span className="text-xl font-bold text-white">+30</span>
                          <span className="text-xs text-slate-500">segundos</span>
                      </button>
                  </div>
                  
                  <button onClick={() => setIsResting(false)} className="mt-8 text-slate-500 hover:text-white text-sm font-medium tracking-wide py-4 w-full rounded-xl hover:bg-white/5 transition-colors">
                      PULAR DESCANSO
                  </button>
              </div>
           </div>
      )}

      {showProgressionModal && (
          <ProgressionModal
            currentExercise={currentExercise}
            goal={profile.goal}
            onCancel={() => setShowProgressionModal(false)}
            onSelect={(newEx) => { onReplaceExercise(currentExercise.id, newEx); setShowProgressionModal(false); }}
          />
      )}
    </div>
  );
};
