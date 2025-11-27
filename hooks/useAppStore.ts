
import { useState, useEffect, useCallback } from 'react';
import { UserProfile, WorkoutRoutine, WorkoutSession, ScheduleEntry, Difficulty, Goal, Exercise } from '../types';
import { generateInitialSchedule, getTodayString, recalculateScheduleLogic, normalizeDate } from '../utils/scheduler';
import { auth, db, googleProvider, signInWithPopup, signOut, doc, getDoc, setDoc, isFirebaseSetup, isFirestoreReachable } from '../services/firebase';

// Fallback ID generator: prefer crypto.randomUUID(), otherwise fallback to timestamp+random
const generateId = () => {
    try {
        // @ts-ignore - crypto available in modern browsers
        if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
            // @ts-ignore
            return (crypto as any).randomUUID();
        }
    } catch (e) {}
    return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
};

const INITIAL_PROFILE: UserProfile = {
  name: 'Atleta',
  level: Difficulty.BEGINNER,
  goal: Goal.HYPERTROPHY,
  availableEquipment: ['Barra Fixa', 'Chão']
};

export const useAppStore = () => {
  const [user, setUser] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile>(INITIAL_PROFILE);
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
    const [firestoreReachable, setFirestoreReachable] = useState<boolean>(true);
    const [partialSyncStatus, setPartialSyncStatus] = useState<Record<string, 'idle'|'uploading'|'synced'|'failed'>>({});
    const [lastPersistError, setLastPersistError] = useState<string | null>(null);
    const [lastPersistOkAt, setLastPersistOkAt] = useState<string | null>(null);

  // Helper para salvar no Firestore se logado, ou LocalStorage se não
  const persistData = useCallback(async (newProfile: any, newRoutines: any, newHistory: any, newSchedule: any) => {
      // Sempre salva no LocalStorage como backup/cache, incluindo timestamp de última atualização
      const payload = { profile: newProfile, routines: newRoutines, history: newHistory, schedule: newSchedule, lastUpdated: new Date().toISOString() };
      try { localStorage.setItem('caliapp_data_v2', JSON.stringify(payload)); } catch (e) { /* ignore */ }

    // Se logado, configurado e reachability ok, salva no Firestore
      if (user && db && isFirebaseSetup && isFirestoreReachable === true) {
          try {
              console.log('[store] persistData: uploading to firestore for user', user.uid, payload);
              await setDoc(doc(db, "users", user.uid), payload);
              setLastPersistError(null);
              setLastPersistOkAt(new Date().toISOString());
              console.log('[store] persistData: upload OK');
          } catch (e: any) {
              console.error("Erro ao salvar na nuvem:", e);
              setLastPersistError(e?.message || String(e));
          }
      } else if (user && isFirebaseSetup && isFirestoreReachable !== false) {
          // Firestore probe still pending (null) or db not yet instantiated: queue payload for later
          try {
              console.log('[store] persistData: queueing payload for later upload (probe pending or db not ready)');
              const key = 'pending_uploads';
              const raw = localStorage.getItem(key);
              const pending: Record<string, any[]> = raw ? JSON.parse(raw) : {};
              const uid = user.uid;
              pending[uid] = pending[uid] || [];
              pending[uid].push(payload);
              localStorage.setItem(key, JSON.stringify(pending));
          } catch (e) { console.warn('[store] failed to queue pending upload', e); }
          console.log('[store] persistData: saved locally only (queued for later)', { user: user?.uid, isFirebaseSetup, isFirestoreReachable });
      } else {
          console.log('[store] persistData: saved locally only (no user/db or firebase not setup or unreachable)', { user, isFirebaseSetup, isFirestoreReachable });
      }
  }, [user]);

  // Auth & Initial Load Effect
  useEffect(() => {
        // Listen for reachability events from services/firebase (probe)
        try {
            const handler = (e: any) => {
                if (e?.detail && typeof e.detail.reachable !== 'undefined') setFirestoreReachable(!!e.detail.reachable);
            };
            window.addEventListener('firestore:reachability', handler as EventListener);
            // initial read (in case probe already ran)
            // @ts-ignore
            try { if (typeof isFirestoreReachable !== 'undefined') setFirestoreReachable(!!isFirestoreReachable); } catch(e) {}
            // cleanup
            var __removeReach = () => { window.removeEventListener('firestore:reachability', handler as EventListener); };
        } catch (e) { var __removeReach = () => {}; }

        // When reachability changes to true, attempt to flush any pending uploads for this user
        const tryFlushPending = async () => {
            try {
                // @ts-ignore
                if (!isFirestoreReachable) return;
                if (!user) return;
                // @ts-ignore
                if (!db) return;
                const key = 'pending_uploads';
                const raw = localStorage.getItem(key);
                if (!raw) return;
                const pending: Record<string, any[]> = JSON.parse(raw);
                const uid = user.uid;
                const myPending = pending[uid] || [];
                if (!myPending.length) return;
                console.log('[store] flushing pending uploads for user', uid, myPending.length);
                for (const payload of myPending) {
                    try {
                        await setDoc(doc(db, 'users', uid), payload);
                    } catch (e) { console.error('[store] failed flushing payload', e); break; }
                }
                // remove flushed entries
                delete pending[uid];
                localStorage.setItem(key, JSON.stringify(pending));
                setLastPersistOkAt(new Date().toISOString());
            } catch (e) { console.warn('[store] tryFlushPending failed', e); }
        };
        tryFlushPending();
    let unsubscribe = () => {};

    if (auth && isFirebaseSetup) {
        unsubscribe = auth.onAuthStateChanged(async (currentUser: any) => {
            setLoading(true);
            setUser(currentUser);
            setAuthError(null);

            if (currentUser && db && isFirestoreReachable) {
                // Carregar da Nuvem
                try {
                    const docRef = doc(db, "users", currentUser.uid);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        const cloud = docSnap.data();
                        // Try to preserve the freshest data between local cache and cloud
                        const saved = localStorage.getItem('caliapp_data_v2');
                        let localData: any = null;
                        if (saved) {
                            try { localData = JSON.parse(saved); } catch(e) { localData = null; }
                        }

                        const cloudTs = cloud?.lastUpdated ? new Date(cloud.lastUpdated).getTime() : 0;
                        const localTs = localData?.lastUpdated ? new Date(localData.lastUpdated).getTime() : 0;

                        if (localData && localTs > cloudTs) {
                            // Local is newer: use local and push to cloud
                            setProfile(localData.profile || INITIAL_PROFILE);
                            setRoutines(localData.routines || []);
                            setHistory(localData.history || []);
                            setSchedule(localData.schedule || []);
                            try { await setDoc(doc(db, "users", currentUser.uid), { ...localData, lastUpdated: new Date().toISOString() }); } catch(e) { console.error('Erro ao enviar localData para a nuvem', e); }
                        } else {
                            // Cloud is newer or local missing: use cloud
                            setProfile(cloud.profile || INITIAL_PROFILE);
                            setRoutines(cloud.routines || []);
                            setHistory(cloud.history || []);
                            setSchedule(cloud.schedule || []);
                        }
                    } else {
                        // Se não tem dados na nuvem, usa os locais (se houver) e salva na nuvem inicial
                        const saved = localStorage.getItem('caliapp_data_v2');
                        if (saved) {
                            const localData = JSON.parse(saved);
                            setProfile(localData.profile || INITIAL_PROFILE);
                            setRoutines(localData.routines || []);
                            setHistory(localData.history || []);
                            setSchedule(localData.schedule || []);
                            // Upload inicial
                            try { await setDoc(doc(db, "users", currentUser.uid), { ...localData, lastUpdated: new Date().toISOString() }); } catch(e) { console.error('Erro ao criar doc inicial na nuvem', e); }
                        }
                    }
                } catch (error) {
                    console.error("Erro ao buscar dados da nuvem:", error);
                }
            } else {
                // Carregar LocalStorage (Modo Guest)
                const saved = localStorage.getItem('caliapp_data_v2');
                if (saved) {
                    try {
                        const data = JSON.parse(saved);
                        if(data.profile) setProfile(data.profile);
                        if(data.routines) setRoutines(data.routines);
                        if(data.history) setHistory(data.history);
                        if(data.schedule) setSchedule(data.schedule);
                    } catch(e) { console.error("Corrupt data", e); }
                }
            }
            setLoading(false);
                        // Cleanup old partial sessions (30 days)
                        try { clearOldPartialSessions(30).catch(() => {}); } catch(e){}
        });
    } else {
        // Fallback se firebase não carregar
        const saved = localStorage.getItem('caliapp_data_v2');
        if (saved) {
             try {
                const data = JSON.parse(saved);
                setProfile(data.profile || INITIAL_PROFILE);
                setRoutines(data.routines || []);
                setHistory(data.history || []);
                setSchedule(data.schedule || []);
             } catch(e) {}
        }
        setLoading(false);
    }

        return () => { try { unsubscribe(); } catch(e){}; try { __removeReach(); } catch(e){} }
  }, []);

  // Auth Actions
  const login = async () => {
      setAuthError(null);
      if (!auth || !isFirebaseSetup) return alert("Configure o arquivo services/firebase.ts primeiro!");
      try {
          await signInWithPopup(auth, googleProvider);
      } catch (error: any) {
          console.error("Erro no login:", error);
          if (error.code === 'auth/unauthorized-domain') {
              const domain = window.location.hostname;
              const msg = `Domínio não autorizado: "${domain}". Adicione-o no Firebase Console -> Authentication -> Settings -> Authorized domains`;
              alert(msg);
              setAuthError(msg);
          } else if (error.code !== 'auth/popup-closed-by-user') {
              setAuthError("Erro ao conectar: " + error.message);
          }
      }
  };

  const logout = async () => {
      if (!auth) return;
      await signOut(auth);
      // Opcional: Limpar estado ao deslogar ou manter cache
      setRoutines([]);
      setHistory([]);
      setSchedule([]);
      window.location.reload(); // Refresh simples para limpar estado
  };

  // Data Actions wrappers to trigger persistence

  const handleSetProfile = (p: UserProfile) => {
      setProfile(p);
      persistData(p, routines, history, schedule);
  };

  const saveRoutines = (newRoutines: WorkoutRoutine[]) => {
    setRoutines(newRoutines);
    const newSchedule = recalculateScheduleLogic(history, newRoutines, []);
    setSchedule(newSchedule);
    persistData(profile, newRoutines, history, newSchedule);
  };

  const addSession = (session: WorkoutSession) => {
    const updatedHistory = [...history, session];
    setHistory(updatedHistory);
    const newSchedule = recalculateScheduleLogic(updatedHistory, routines, schedule);
    setSchedule(newSchedule);
    persistData(profile, routines, updatedHistory, newSchedule);
  };

  const updateSession = (updatedSession: WorkoutSession) => {
    const updatedHistory = history.map(h => h.id === updatedSession.id ? updatedSession : h);
    setHistory(updatedHistory);
    const newSchedule = recalculateScheduleLogic(updatedHistory, routines, schedule);
    setSchedule(newSchedule);
    persistData(profile, routines, updatedHistory, newSchedule);
  };

  const deleteSession = (sessionId: string) => {
      const deletedSession = history.find(h => h.id === sessionId);
      const updatedHistory = history.filter(h => h.id !== sessionId);
      setHistory(updatedHistory);
      
      // Limpar o dia específico na agenda antes de recalcular
      let tempSchedule = [...schedule];
      if (deletedSession) {
          const dateKey = normalizeDate(deletedSession.date);
          tempSchedule = tempSchedule.map(s => {
              if (s.date === dateKey) {
                  const { completed, routineId, ...rest } = s; // Remove completed e ID se for log avulso
                  return { ...rest, type: s.type }; // Mantém tipo base ou reseta
              }
              return s;
          });
      }

      const newSchedule = recalculateScheduleLogic(updatedHistory, routines, []);
      setSchedule(newSchedule);
      persistData(profile, routines, updatedHistory, newSchedule);
  };

  const replaceExercise = (oldExId: string, newEx: Exercise) => {
      const newRoutines = routines.map(r => {
          if (r.exercises.find(e => e.id === oldExId)) {
              return {
                  ...r,
                  exercises: r.exercises.map(e => e.id === oldExId ? newEx : e)
              };
          }
          return r;
      });
      setRoutines(newRoutines);
      persistData(profile, newRoutines, history, schedule);
  };

  // Partial session persistence (local + cloud when logged)
  const savePartialSession = async (routineId: string, partial: any) => {
      const key = `session_progress_${routineId}`;
      const withMeta = { ...partial, _updatedAt: new Date().toISOString() };
      try {
          localStorage.setItem(key, JSON.stringify(withMeta));
      } catch (e) { /* ignore */ }

      setPartialSyncStatus(prev => ({ ...prev, [routineId]: 'uploading' }));
    if (user && db && isFirebaseSetup && isFirestoreReachable) {
          try {
              const docRef = doc(db, "users", user.uid);
              await setDoc(docRef, { partialSessions: { [routineId]: withMeta } }, { merge: true });
              setPartialSyncStatus(prev => ({ ...prev, [routineId]: 'synced' }));
          } catch (e) {
              console.error('Erro ao salvar partial session na nuvem', e);
              setPartialSyncStatus(prev => ({ ...prev, [routineId]: 'failed' }));
          }
      } else {
          // Not logged / no firebase: mark as idle (local-only)
          setPartialSyncStatus(prev => ({ ...prev, [routineId]: 'idle' }));
      }
  };

  const loadPartialSession = async (routineId: string) => {
      const key = `session_progress_${routineId}`;
      let local: any = null;
      try {
          const raw = localStorage.getItem(key);
          if (raw) local = JSON.parse(raw);
      } catch (e) { local = null; }

    if (user && db && isFirebaseSetup && isFirestoreReachable) {
          try {
              const docRef = doc(db, "users", user.uid);
              const snap = await getDoc(docRef);
              if (snap.exists()) {
                  const data: any = snap.data();
                  const cloud = data?.partialSessions && data.partialSessions[routineId] ? data.partialSessions[routineId] : null;
                  // Return the latest by _updatedAt
                  if (cloud && local) {
                      const c = new Date(cloud._updatedAt || 0).getTime();
                      const l = new Date(local._updatedAt || 0).getTime();
                      return c >= l ? cloud : local;
                  }
                  return cloud || local;
              }
          } catch (e) {
              console.error('Erro ao carregar partial session da nuvem', e);
          }
      }
      return local;
  };

  const clearPartialSession = async (routineId: string) => {
      const key = `session_progress_${routineId}`;
      try { localStorage.removeItem(key); } catch (e) {}

    if (user && db && isFirebaseSetup && isFirestoreReachable) {
          try {
              const docRef = doc(db, "users", user.uid);
              const snap = await getDoc(docRef);
              if (snap.exists()) {
                  const data: any = snap.data();
                  const sessions = data?.partialSessions || {};
                  if (sessions[routineId]) {
                      delete sessions[routineId];
                      await setDoc(docRef, { partialSessions: sessions }, { merge: true });
                  }
                  setPartialSyncStatus(prev => ({ ...prev, [routineId]: 'idle' }));
              }
          } catch (e) {
              console.error('Erro ao limpar partial session na nuvem', e);
          }
      }
  };

  // Remove partial sessions older than `days` (local + cloud when possible)
  const clearOldPartialSessions = async (days = 14) => {
      const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
      // Local cleanup
      Object.keys(localStorage).forEach(k => {
          if (k.startsWith('session_progress_')) {
              try {
                  const raw = localStorage.getItem(k);
                  if (!raw) return;
                  const obj = JSON.parse(raw);
                  const t = new Date(obj._updatedAt || 0).getTime();
                  if (t < threshold) localStorage.removeItem(k);
              } catch (e) {}
          }
      });

      // Cloud cleanup: attempt to remove older partials from the user doc
      if (user && db && isFirebaseSetup) {
          try {
              const docRef = doc(db, "users", user.uid);
              const snap = await getDoc(docRef);
              if (snap.exists()) {
                  const data: any = snap.data();
                  const sessions = data?.partialSessions || {};
                  let changed = false;
                  Object.keys(sessions).forEach(rid => {
                      const t = new Date(sessions[rid]._updatedAt || 0).getTime();
                      if (t < threshold) {
                          delete sessions[rid];
                          changed = true;
                      }
                  });
                  if (changed) await setDoc(docRef, { partialSessions: sessions }, { merge: true });
              }
          } catch (e) { console.error('Erro ao limpar partials antigos na nuvem', e); }
      }
  };

  // Commit partial session into history as a draft session (merge logic handled by loadPartialSession earlier)
  const commitPartialToHistory = async (routineId: string) => {
      const partial = await loadPartialSession(routineId);
      if (!partial) return null;
      // Create a WorkoutSession-like object
      const session: any = {
          id: crypto?.randomUUID ? crypto.randomUUID() : generateId(),
          routineId,
          date: new Date().toISOString(),
          durationSeconds: partial.elapsed || 0,
          logs: partial.logs || [],
          draft: true,
      };
      addSession(session);
      await clearPartialSession(routineId);
      return session;
  };

  const deleteRoutine = (id: string) => {
      const newRoutines = routines.filter(r => r.id !== id);
      setRoutines(newRoutines);
      const newSchedule = recalculateScheduleLogic(history, newRoutines, schedule);
      setSchedule(newSchedule);
      persistData(profile, newRoutines, history, newSchedule);
  };

  const updateRoutine = (updated: WorkoutRoutine) => {
      const newRoutines = routines.map(r => r.id === updated.id ? updated : r);
      setRoutines(newRoutines);
      persistData(profile, newRoutines, history, schedule);
  }

  return {
      user, login, logout, isConfigured: isFirebaseSetup, authError,
      firestoreReachable,
      profile, setProfile: handleSetProfile,
      routines, saveRoutines, deleteRoutine, updateRoutine,
      history, addSession, updateSession, deleteSession,
      schedule, setSchedule,
      replaceExercise,
      savePartialSession,
      loadPartialSession,
      clearPartialSession,
      clearOldPartialSessions,
      commitPartialToHistory,
      partialSyncStatus,
      loading
  };
};
