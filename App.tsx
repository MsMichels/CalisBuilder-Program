
import React, { useState } from 'react';
import { Calendar as CalendarIcon, Timer, Dumbbell, Trash2, Pencil, CheckCircle2, Plus } from 'lucide-react';
import { Button } from './components/Button';
import { WorkoutRoutine, WorkoutSession, Difficulty, Goal, SetLog } from './types';
import { useAppStore } from './hooks/useAppStore';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { SessionRunner } from './components/SessionRunner';
import { CalendarView } from './components/CalendarView';
import { RoutineCreator, RoutineEditor, SessionEditor, ManualLogModal, SessionDetailsModal } from './components/Modals';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [activeRoutine, setActiveRoutine] = useState<WorkoutRoutine | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<WorkoutRoutine | null>(null);
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null);
  const [viewingSession, setViewingSession] = useState<WorkoutSession | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [manualLogDate, setManualLogDate] = useState<string | null>(null);

  const store = useAppStore();

  const handleFinishWorkout = (session: WorkoutSession) => {
    store.addSession(session);
    setActiveRoutine(null);
    setCurrentView('history');
  };

  const handleManualLog = (session: WorkoutSession) => {
    store.addSession(session);
    setManualLogDate(null);
  };

  // Safe delete handler wrapper to ensure event stopPropagation
  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      e.preventDefault();
      if(window.confirm('Excluir este registro? A agenda será recalculada.')) {
          store.deleteSession(sessionId);
      }
  };

  const renderWorkoutSelection = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Seus Treinos</h2>
        <Button onClick={() => setShowGenerator(true)}><Plus size={18} /> Novo</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {store.routines.map(routine => (
          <div key={routine.id} className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-emerald-500 transition-all cursor-pointer group relative hover:shadow-lg" onClick={() => { setActiveRoutine(routine); setCurrentView('workout'); }}>
             <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-2 text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg" onClick={(e) => { e.stopPropagation(); setEditingRoutine(routine); }}><Pencil size={16} /></button>
                <button className="p-2 text-slate-400 hover:text-red-400 bg-slate-700 hover:bg-slate-600 rounded-lg" onClick={(e) => { e.stopPropagation(); store.deleteRoutine(routine.id); }}><Trash2 size={16} /></button>
            </div>
            <h3 className="font-bold text-lg text-white group-hover:text-emerald-400">{routine.name}</h3>
            <p className="text-slate-400 text-sm mb-4 line-clamp-2 h-10">{routine.description}</p>
            <div className="flex gap-2 text-xs text-slate-500">
              <span className="bg-slate-900 px-2 py-1 rounded border border-slate-700 flex items-center gap-1"><Dumbbell size={12}/> {routine.exercises.length} Ex</span>
              <span className="bg-slate-900 px-2 py-1 rounded border border-slate-700 flex items-center gap-1"><Timer size={12}/> ~{Math.round(routine.exercises.reduce((acc, ex) => acc + (ex.targetSets * (ex.restSeconds + 45)), 0) / 60)} min</span>
            </div>
          </div>
        ))}
        {store.routines.length === 0 && <div className="col-span-2 text-center py-16 bg-slate-800/30 rounded-xl border border-dashed border-slate-700"><Dumbbell className="mx-auto h-12 w-12 text-slate-600 mb-3" /><h3 className="text-lg font-medium text-slate-300">Nenhum treino disponível</h3><Button onClick={() => setShowGenerator(true)}>Criar Agora</Button></div>}
      </div>
    </div>
  );

  const renderHistory = () => (
      <div className="space-y-6 animate-in fade-in duration-300">
          <h2 className="text-2xl font-bold text-white">Histórico de Treinos</h2>
          <div className="space-y-4">
              {store.history.slice().reverse().map((session) => {
                  const routineName = store.routines.find(r => r.id === session.routineId)?.name || 'Treino (Removido)';
                  let vol = 0; 
                  (Object.values(session.logs) as SetLog[][]).forEach(logs => logs.forEach(l => vol += l.reps));
                  return (
                    <div key={session.id} onClick={() => setViewingSession(session)} className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex justify-between items-center hover:bg-slate-750 transition-colors group cursor-pointer hover:border-slate-600">
                        <div>
                            <h4 className="font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">{routineName} <span className="text-xs font-normal text-slate-500 ml-2">{session.notes}</span></h4>
                            <div className="flex gap-3 text-sm text-slate-400">
                                <span className="flex items-center gap-1"><CalendarIcon size={14}/> {new Date(session.date).toLocaleDateString('pt-BR')}</span>
                                <span className="flex items-center gap-1"><Timer size={14}/> {Math.floor(session.durationSeconds / 60)} min</span>
                                <span className="flex items-center gap-1"><Dumbbell size={14}/> {vol} reps</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                             <button onClick={(e) => { e.stopPropagation(); setEditingSession(session); }} className="p-2 text-slate-500 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors border border-slate-700"><Pencil size={18}/></button>
                            <button onClick={(e) => handleDeleteSession(e, session.id)} className="p-2 text-slate-500 hover:text-red-400 bg-slate-800 hover:bg-slate-700 rounded transition-colors border border-slate-700"><Trash2 size={18}/></button>
                            <div className="text-emerald-500 ml-2"><CheckCircle2 /></div>
                        </div>
                    </div>
                  );
              })}
              {store.history.length === 0 && <p className="text-slate-500 text-center py-10">Você ainda não completou nenhum treino.</p>}
          </div>
      </div>
  );

  const renderProfile = () => (
      <div className="space-y-6 animate-in fade-in duration-300 max-w-lg mx-auto">
          <h2 className="text-2xl font-bold text-white">Seu Perfil</h2>
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
              <div><label className="block text-sm font-medium text-slate-400 mb-1">Nome</label><input type="text" value={store.profile.name} onChange={(e) => store.setProfile({...store.profile, name: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white" /></div>
              <div><label className="block text-sm font-medium text-slate-400 mb-1">Nível</label><select value={store.profile.level} onChange={(e) => store.setProfile({...store.profile, level: e.target.value as Difficulty})} className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white">{Object.values(Difficulty).map(d => <option key={d} value={d}>{d}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-slate-400 mb-1">Objetivo</label><select value={store.profile.goal} onChange={(e) => store.setProfile({...store.profile, goal: e.target.value as Goal})} className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white">{Object.values(Goal).map(g => <option key={g} value={g}>{g}</option>)}</select></div>
          </div>
      </div>
  );

  return (
      <Layout currentView={currentView} onViewChange={(v) => { setCurrentView(v); setActiveRoutine(null); }}>
        {currentView === 'dashboard' && <Dashboard profile={store.profile} history={store.history} routines={store.routines} schedule={store.schedule} onStartWorkout={(r) => { setActiveRoutine(r); setCurrentView('workout'); }} onCreateRoutine={() => setShowGenerator(true)} />}
        {currentView === 'calendar' && (
            <CalendarView 
                schedule={store.schedule} 
                routines={store.routines} 
                history={store.history}
                onUpdateSchedule={store.setSchedule} 
                onManualLog={setManualLogDate}
                onDeleteSession={store.deleteSession}
                onViewSession={setViewingSession}
            />
        )}
        {currentView === 'workout' && !activeRoutine && renderWorkoutSelection()}
        {currentView === 'workout' && activeRoutine && <SessionRunner routine={activeRoutine} previousSession={store.history.filter(h => h.routineId === activeRoutine.id).pop()} profile={store.profile} onFinish={handleFinishWorkout} onCancel={() => setActiveRoutine(null)} onReplaceExercise={store.replaceExercise} />}
        {currentView === 'history' && renderHistory()}
        {currentView === 'profile' && renderProfile()}

        {showGenerator && <RoutineCreator profile={store.profile} onSave={(r) => { store.saveRoutines(r); setShowGenerator(false); }} onCancel={() => setShowGenerator(false)} />}
        {manualLogDate && <ManualLogModal date={manualLogDate} routines={store.routines} onSave={handleManualLog} onCancel={() => setManualLogDate(null)} />}
        {editingRoutine && <RoutineEditor routine={editingRoutine} onSave={(r) => { store.updateRoutine(r); setEditingRoutine(null); }} onCancel={() => setEditingRoutine(null)} />}
        {editingSession && <SessionEditor session={editingSession} routines={store.routines} onSave={(s) => { store.updateSession(s); setEditingSession(null); }} onCancel={() => setEditingSession(null)} />}
        {viewingSession && <SessionDetailsModal session={viewingSession} routines={store.routines} onClose={() => setViewingSession(null)} onDelete={store.deleteSession} />}
      </Layout>
  );
}
