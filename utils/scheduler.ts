
import { ScheduleEntry, WorkoutRoutine, WorkoutSession } from '../types';

// Essa função é o coração da correção de data.
// Ela garante que qualquer input (String ISO, String YYYY-MM-DD, ou Objeto Date)
// seja convertido para YYYY-MM-DD considerando o Fuso Horário LOCAL do usuário.
export const normalizeDate = (dateInput: string | Date): string => {
    if (!dateInput) return "";

    let dateObj: Date;

    if (dateInput instanceof Date) {
        dateObj = dateInput;
    } else if (typeof dateInput === 'string') {
        // Se for string YYYY-MM-DD simples, já está normalizada
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            return dateInput;
        }
        // Se for ISO string (tem T ou Z), converte para Date objeto
        dateObj = new Date(dateInput);
    } else {
        return "";
    }

    if (isNaN(dateObj.getTime())) return "";

    // Extrai componentes LOCAIS (não UTC)
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
};

export const getTodayString = () => {
    return normalizeDate(new Date());
};

export const generateCalendarDays = (daysCount: number = 35): string[] => {
    const dates = [];
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() - 7);
    
    for(let i=0; i < daysCount; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        dates.push(normalizeDate(d));
    }
    return dates;
};

// Define o ciclo ideal de treinos e descansos baseado na quantidade de rotinas
// Retorna um array onde: número = índice da rotina, null = descanso
const getPatternForRoutines = (count: number): (number | null)[] => {
    if (count === 1) return [0, null]; // Full Body: Treino, Descanso
    if (count === 2) return [0, 1, null]; // AB: A, B, Descanso
    if (count === 3) return [0, 1, 2, null]; // PPL: A, B, C, Descanso
    if (count >= 4) return [0, 1, null, 2, 3, null, null]; // ABCD: A, B, Descanso, C, D, Descanso, Descanso
    return [0, null]; // Fallback
};

export const generateInitialSchedule = (
    startDateStr: string, 
    routines: WorkoutRoutine[], 
    daysCount: number = 60,
    startPatternIndex: number = 0
): ScheduleEntry[] => {
    if (routines.length === 0) return [];
    
    const schedule: ScheduleEntry[] = [];
    const [y, m, d] = startDateStr.split('-').map(Number);
    const currentDate = new Date(y, m - 1, d, 12, 0, 0);
    
    const pattern = getPatternForRoutines(routines.length);
    let currentIdx = startPatternIndex % pattern.length;
    
    for (let i = 0; i < daysCount; i++) {
        const dateStr = normalizeDate(currentDate);
        const step = pattern[currentIdx];
        
        if (step === null) {
             schedule.push({ date: dateStr, type: 'rest' });
        } else {
             // Garante que o índice da rotina exista (segurança)
             const safeRoutineIdx = step % routines.length;
             schedule.push({ date: dateStr, type: 'workout', routineId: routines[safeRoutineIdx].id });
        }
        
        currentIdx = (currentIdx + 1) % pattern.length;
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return schedule;
};

export const recalculateScheduleLogic = (
    history: WorkoutSession[], 
    routines: WorkoutRoutine[],
    currentSchedule: ScheduleEntry[] // Usado apenas para preservar registros passados se necessário, mas a lógica agora reconstrói
): ScheduleEntry[] => {
    if (routines.length === 0) return [];

    // 1. Organizar Histórico Cronologicamente
    const sortedHistory = [...history].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const lastSession = sortedHistory[sortedHistory.length - 1];

    // 2. Definir Ponto de Partida (Start Date) e Índice do Padrão
    let nextStartDateStr: string;
    let nextPatternIndex = 0;
    const pattern = getPatternForRoutines(routines.length);

    if (!lastSession) {
        // Se não tem histórico, começa de HOJE do zero
        nextStartDateStr = getTodayString();
        nextPatternIndex = 0;
    } else {
        // Se tem histórico, a agenda futura começa AMANHÃ em relação ao último treino
        const lastDate = normalizeDate(lastSession.date);
        const [ly, lm, ld] = lastDate.split('-').map(Number);
        const dateObj = new Date(ly, lm - 1, ld, 12, 0, 0);
        dateObj.setDate(dateObj.getDate() + 1);
        nextStartDateStr = normalizeDate(dateObj);

        // Descobrir qual foi o último passo do padrão realizado
        const lastRoutineIndex = routines.findIndex(r => r.id === lastSession.routineId);
        
        if (lastRoutineIndex !== -1) {
            // Tenta achar a posição dessa rotina no padrão
            // Ex: Padrão [0, 1, null]. Se fiz a rotina 0, o índice no padrão é 0.
            // Se o padrão tiver repetidos, pegamos o primeiro match lógico ou iteramos.
            // Simplificação: Acha o índice no padrão correspondente a essa rotina.
            let foundPatternIdx = pattern.indexOf(lastRoutineIndex);
            
            // Caso especial ABCD: [0, 1, null, 2, 3, null, null]
            // Se fiz a rotina 1 (B), pode ser índice 1.
            // Se fiz a rotina 2 (C), é índice 3.
            if (foundPatternIdx !== -1) {
                nextPatternIndex = (foundPatternIdx + 1) % pattern.length;
            } else {
                // Se a rotina do histórico não bate com o padrão atual (ex: mudou de plano), reinicia
                nextPatternIndex = 0;
            }
        }
    }

    // 3. Reconstruir a Agenda
    // Parte A: Passado (Baseado no histórico real + preenchimento de gaps como descanso)
    // Para simplificar e evitar conflitos visuais:
    // Apenas criamos entradas para os dias que TÊM histórico. Dias sem histórico no passado ficam vazios (ou implícitos).
    // O CalendarView já trata dias vazios como neutros.
    
    const finalSchedule: ScheduleEntry[] = [];

    // Adiciona entradas para todo o histórico existente
    sortedHistory.forEach(session => {
        finalSchedule.push({
            date: normalizeDate(session.date),
            type: 'workout',
            routineId: session.routineId,
            completed: true
        });
    });

    // Parte B: Futuro (Gerado a partir do nextStartDate)
    // Gera 60 dias para frente a partir do ponto de corte
    const futureSchedule = generateInitialSchedule(nextStartDateStr, routines, 60, nextPatternIndex);

    // Mescla garantindo que não sobrescreva o histórico se houver conflito de data (embora nextStartDateStr deva evitar isso)
    const scheduleMap = new Map();
    
    // Primeiro popula com histórico (prioridade máxima)
    finalSchedule.forEach(s => scheduleMap.set(s.date, s));
    
    // Depois popula com futuro, apenas se não existir entrada naquela data
    futureSchedule.forEach(s => {
        if (!scheduleMap.has(s.date)) {
            scheduleMap.set(s.date, s);
        }
    });

    return Array.from(scheduleMap.values()).sort((a,b) => a.date.localeCompare(b.date));
};
