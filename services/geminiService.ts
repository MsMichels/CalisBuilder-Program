import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, WorkoutRoutine, Exercise, Difficulty, Goal } from '../types';

// Lazy initialize the AI client to avoid creating it at module import time
let ai: any = null;
const getAI = () => {
  if (ai) return ai;
  const apiKey = typeof process !== 'undefined' && process.env && process.env.API_KEY ? process.env.API_KEY : undefined;
  if (!apiKey) {
    return null; // Caller should handle missing client
  }
  ai = new GoogleGenAI({ apiKey });
  return ai;
};

// --- Offline / Local fallbacks (funciona sem custo) ---
// Expanded local exercise library: basic -> advanced, with short descriptions.
// This list is used as a free offline fallback (development/testing) and is
// intentionally conservative: it provides sensible sets and progression names
// for calisthenics strength and hypertrophy.
const COMMON_EXERCISES: { name: string; muscle: string; desc?: string }[] = [
  // Chest / Push
  { name: 'Push-up', muscle: 'Peito', desc: 'Flexão padrão, base para progressões' },
  { name: 'Incline Push-up', muscle: 'Peito', desc: 'Mãos elevadas - mais fácil' },
  { name: 'Decline Push-up', muscle: 'Peito', desc: 'Pés elevados - mais difícil' },
  { name: 'Diamond Push-up', muscle: 'Peito/Tríceps', desc: 'Mais ênfase em tríceps' },
  { name: 'Archer Push-up', muscle: 'Peito', desc: 'Progressão unilateral para força assimétrica' },
  { name: 'Pseudo Planche Push-up', muscle: 'Peito/ombros', desc: 'Prepara planche, alto esforço de ombro' },

  // Pull / Back
  { name: 'Australian Pull-up', muscle: 'Costas', desc: 'Remada invertida - progressão para pull-up' },
  { name: 'Bodyweight Row', muscle: 'Costas', desc: 'Remada corporal em barra baixa' },
  { name: 'Negative Pull-up', muscle: 'Costas', desc: 'Descidas controladas para ganhar força' },
  { name: 'Assisted Pull-up', muscle: 'Costas', desc: 'Com banda ou apoio' },
  { name: 'Pull-up', muscle: 'Costas', desc: 'Barra fixa - objetivo para resistência/força' },
  { name: 'Archer Row', muscle: 'Costas', desc: 'Remada unilateral/assimétrica' },

  // Legs
  { name: 'Squat', muscle: 'Pernas', desc: 'Agachamento corporal' },
  { name: 'Goblet Squat (DB)', muscle: 'Pernas', desc: 'Agachamento com peso (opcional)' },
  { name: 'Bulgarian Split Squat', muscle: 'Pernas', desc: 'Agachamento unilateral' },
  { name: 'Pistol Progression', muscle: 'Pernas', desc: 'Progresso para pistol squat' },
  { name: 'Pistol Squat', muscle: 'Pernas', desc: 'Agachamento unipodal completo' },

  // Dips / Triceps / Shoulders
  { name: 'Bench Dip', muscle: 'Tríceps', desc: 'Mergulho com apoio - mais fácil' },
  { name: 'Parallel Dips', muscle: 'Tríceps/Peito', desc: 'Dips em paralelas' },
  { name: 'Ring Dip', muscle: 'Tríceps/Peito', desc: 'Dips em argolas - instável e avançado' },

  // Core / Isometrias
  { name: 'Plank', muscle: 'Core', desc: 'Prancha - isometria de core' },
  { name: 'Hollow Hold', muscle: 'Core', desc: 'Isometria abdominal para estabilidade' },
  { name: 'L-sit', muscle: 'Core', desc: 'Isometria de abdômen e flexores do quadril' },
  { name: 'Dragon Flag (Progression)', muscle: 'Core', desc: 'Alta exigência para core' },

  // Pulling/Upper Advanced
  { name: 'Muscle-up (Transition)', muscle: 'Costas/Peito', desc: 'Transição pull->dip na barra/argolas' },
  { name: 'Chest-to-Bar Pull-up', muscle: 'Costas', desc: 'Pull-up alto - preparação para muscle-up' },

  // Planche/Static Advanced
  { name: 'Tuck Planche', muscle: 'Ombros/Core', desc: 'Isometria inicial para planche' },
  { name: 'Advanced Tuck Planche', muscle: 'Ombros/Core', desc: 'Próximo passo rumo à planche' },
  { name: 'Planche (Full)', muscle: 'Ombros/Core', desc: 'Isometria avançada de ombro/peito' },

  // Misc
  { name: 'Handstand (Wall)', muscle: 'Ombros/Core', desc: 'Parada de mão com apoio' },
  { name: 'Handstand Push-up (Wall)', muscle: 'Ombros', desc: 'Flexão invertida com apoio' },
];

// Progression mapping: base exercise -> ordered progression list (easier->harder)
const PROGRESSION_MAP: Record<string, string[]> = {
  'push-up': ['Incline Push-up', 'Push-up', 'Decline Push-up', 'Diamond Push-up', 'Archer Push-up', 'Pseudo Planche Push-up', 'One-arm Push-up'],
  'pull-up': ['Assisted Pull-up', 'Negative Pull-up', 'Pull-up', 'Chest-to-Bar Pull-up', 'Muscle-up (Transition)'],
  'row': ['Bodyweight Row', 'Australian Pull-up', 'Archer Row', 'One-arm Row (advanced)'],
  'squat': ['Squat', 'Goblet Squat (DB)', 'Bulgarian Split Squat', 'Pistol Progression', 'Pistol Squat'],
  'dip': ['Bench Dip', 'Parallel Dips', 'Ring Dip', 'Weighted Dip'],
  'handstand': ['Handstand (Wall)', 'Handstand Push-up (Wall)'],
  'planche': ['Tuck Planche', 'Advanced Tuck Planche', 'Planche (Full)'],
  'l-sit': ['Plank', 'L-sit', 'L-sit to Tuck', 'V-sit'],
};

const pickExercises = (count = 6, avoid: string[] = []) => {
  const pool = COMMON_EXERCISES.filter(e => !avoid.includes(e.name));
  // Shuffle pool and take first `count` to avoid duplicates
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  const selection = shuffled.slice(0, Math.min(count, shuffled.length));
  return selection.map(ex => ({
    id: crypto.randomUUID(),
    name: ex.name,
    muscleGroup: ex.muscle,
    description: ex.desc || '',
    targetSets: 3,
    targetReps: '15',
    restSeconds: 60
  }));
};

const generateRoutineLocal = (profile: UserProfile, splitType = 'full_body'): WorkoutRoutine[] => {
  // Create sensible splits and distribute exercises by focus
  if (splitType === 'full_body') {
    return [{
      id: crypto.randomUUID(),
      name: 'Full Body',
      description: `Rotina Full Body (local) - ${profile.goal}`,
      exercises: pickExercises(6)
    }];
  }

  if (splitType === 'upper_lower') {
    // Upper: puxar + empurrar (peito, costas, ombro, tríceps)
    const upper = pickExercises(6).filter(e => /push|pull|row|dip|press|handstand|pull-up|push-up|dips|ar\w+/i.test(e.name) || true).slice(0,6);
    // Lower: pernas
    const lower = pickExercises(5).filter(e => /squat|pistol|split|leg|goblet|pistol/i.test(e.name) || true).slice(0,5);

    return [
      { id: crypto.randomUUID(), name: 'Upper', description: 'Treino de membros superiores', exercises: upper },
      { id: crypto.randomUUID(), name: 'Lower', description: 'Treino de membros inferiores', exercises: lower }
    ];
  }

  if (splitType === 'upper_lower_abcd') {
    // ABCD: Upper A, Lower A, Upper B, Lower B — vary exercises between A/B
    const upperA = pickExercises(5);
    const lowerA = pickExercises(5);
    const upperB = pickExercises(5, upperA.map(e => e.name));
    const lowerB = pickExercises(5, lowerA.map(e => e.name));

    return [
      { id: crypto.randomUUID(), name: 'Upper A', description: 'Upper - A', exercises: upperA },
      { id: crypto.randomUUID(), name: 'Lower A', description: 'Lower - A', exercises: lowerA },
      { id: crypto.randomUUID(), name: 'Upper B', description: 'Upper - B', exercises: upperB },
      { id: crypto.randomUUID(), name: 'Lower B', description: 'Lower - B', exercises: lowerB }
    ];
  }

  if (splitType === 'ppl') {
    // Push / Pull / Legs
    const push = pickExercises(5).filter(e => /push|dip|press|handstand|push-up|dips/i.test(e.name) || true).slice(0,5);
    const pull = pickExercises(5).filter(e => /pull|row|chin|australian|pull-up|bodyweight row/i.test(e.name) || true).slice(0,5);
    const legs = pickExercises(5).filter(e => /squat|pistol|split|leg|goblet/i.test(e.name) || true).slice(0,5);

    return [
      { id: crypto.randomUUID(), name: 'Push', description: 'Push day (peito/ombro/tríceps)', exercises: push },
      { id: crypto.randomUUID(), name: 'Pull', description: 'Pull day (costas/bíceps)', exercises: pull },
      { id: crypto.randomUUID(), name: 'Legs', description: 'Leg day', exercises: legs }
    ];
  }

  // Default fallback: single routine
  return [{ id: crypto.randomUUID(), name: 'Routine (Local)', description: 'Gerado localmente', exercises: pickExercises(6) }];
};

const suggestProgressionLocal = (exerciseName: string, recentLogs: string, goal: Goal) => {
  const name = exerciseName.toLowerCase();
  if (name.includes('push')) return 'Tente variações mais difíceis: Incline -> Decline -> Diamond -> Archer -> One-arm (progredir por elevação/ângulo).';
  if (name.includes('pull') || name.includes('row')) return 'Progrida: Australian -> Negative -> Assisted -> Pull-up -> Weighted pull-up.';
  if (name.includes('squat') || name.includes('pistol')) return 'Progrida: Box pistol -> Assisted pistol -> Pistol -> Weighted pistol.';
  if (name.includes('dip')) return 'Progrida: Bench dip -> Parallel dips -> Ring dips -> Weighted dips.';
  return 'Aumente reps, reduza descanso ou escolha uma variação com maior dificuldade (ex: archer/uneven/one-arm).';
};

const getVariationsLocal = (currentExercise: Exercise) => {
  const base = currentExercise.name.toLowerCase();
  // Try to find a progression chain that matches this exercise
  for (const key of Object.keys(PROGRESSION_MAP)) {
    const chain = PROGRESSION_MAP[key];
    const idx = chain.findIndex(name => name.toLowerCase() === currentExercise.name.toLowerCase());
    if (idx !== -1) {
      // Return up to next 3 harder variations from the chain
      const variations: Exercise[] = [];
      for (let i = idx + 1; i < Math.min(chain.length, idx + 4); i++) {
        const name = chain[i];
        variations.push({
          id: crypto.randomUUID(),
          name,
          muscleGroup: currentExercise.muscleGroup,
          description: `Progressão: ${name}`,
          targetSets: currentExercise.targetSets || 3,
          targetReps: currentExercise.targetReps || '10-12',
          restSeconds: Math.max(45, (currentExercise.restSeconds || 60) + 15)
        });
      }
      if (variations.length > 0) return variations;
    }
  }

  // If no exact chain match, fallback to heuristic mapping
  const variations: Exercise[] = [];
  if (base.includes('push')) {
    variations.push({ id: crypto.randomUUID(), name: 'Diamond Push-up', muscleGroup: currentExercise.muscleGroup, description: 'Mãos próximas - mais tríceps', targetSets: 3, targetReps: '12', restSeconds: 75 });
    variations.push({ id: crypto.randomUUID(), name: 'Archer Push-up', muscleGroup: currentExercise.muscleGroup, description: 'Progressão unilateral', targetSets: 3, targetReps: '8-12', restSeconds: 90 });
    variations.push({ id: crypto.randomUUID(), name: 'Decline Push-up', muscleGroup: currentExercise.muscleGroup, description: 'Mais ênfase superior', targetSets: 3, targetReps: '10-15', restSeconds: 75 });
  } else if (base.includes('pull') || base.includes('row')) {
    variations.push({ id: crypto.randomUUID(), name: 'Australian Pull-up', muscleGroup: currentExercise.muscleGroup, description: 'Remada invertida mais difícil', targetSets: 3, targetReps: '12-15', restSeconds: 75 });
    variations.push({ id: crypto.randomUUID(), name: 'Negative Pull-up', muscleGroup: currentExercise.muscleGroup, description: 'Descida controlada', targetSets: 3, targetReps: '6-8', restSeconds: 90 });
    variations.push({ id: crypto.randomUUID(), name: 'Archer Row', muscleGroup: currentExercise.muscleGroup, description: 'Variante unilateral', targetSets: 3, targetReps: '8-12', restSeconds: 90 });
  } else {
    variations.push({ id: crypto.randomUUID(), name: `${currentExercise.name} (Progressão 1)`, muscleGroup: currentExercise.muscleGroup, description: 'Progressão 1', targetSets: currentExercise.targetSets || 3, targetReps: currentExercise.targetReps || '12', restSeconds: currentExercise.restSeconds || 60 });
    variations.push({ id: crypto.randomUUID(), name: `${currentExercise.name} (Progressão 2)`, muscleGroup: currentExercise.muscleGroup, description: 'Progressão 2', targetSets: currentExercise.targetSets || 3, targetReps: currentExercise.targetReps || '10', restSeconds: currentExercise.restSeconds || 75 });
    variations.push({ id: crypto.randomUUID(), name: `${currentExercise.name} (Progressão 3)`, muscleGroup: currentExercise.muscleGroup, description: 'Progressão 3', targetSets: currentExercise.targetSets || 3, targetReps: currentExercise.targetReps || '8', restSeconds: currentExercise.restSeconds || 90 });
  }
  return variations;
};

const quickTips = [
  'Mantenha a técnica antes de adicionar volume.',
  'Descansos curtos geram mais resistência; descansos longos favorecem força.',
  'Progrida ângulo/volume antes de adicionar carga externa.',
  'Consistência semanal é a chave — 3x/sem é melhor que 1x/sem intenso.'
];
// --- fim fallbacks ---

export const generateRoutine = async (profile: UserProfile, splitType: string = 'full_body'): Promise<WorkoutRoutine[]> => {
  const model = "gemini-2.5-flash";
  
  let splitInstruction = "Crie uma rotina de corpo todo (Full Body).";
  if (splitType === 'upper_lower') {
    splitInstruction = "Crie 2 rotinas distintas: uma focada em Superiores (Upper) e outra em Inferiores (Lower). Ideal para sequência AB.";
  } else if (splitType === 'upper_lower_abcd') {
    splitInstruction = "Crie 4 rotinas distintas seguindo a sequência: Upper A, Lower A, Upper B, Lower B. Varie os exercícios entre os dias A e B para estimular diferentes ângulos ou intensidades (ABCD).";
  } else if (splitType === 'ppl') {
    splitInstruction = "Crie 3 rotinas distintas: Empurrar (Push), Puxar (Pull) e Pernas (Legs).";
  }

  const prompt = `
    Crie uma estrutura de treino de calistenia para uma pessoa com o seguinte perfil:
    Nível: ${profile.level}
    Objetivo: ${profile.goal}
    Equipamento disponível: ${profile.availableEquipment.join(', ')}.
    
    Tipo de Divisão Solicitada: ${splitInstruction}
    
    Diretrizes de Treino (RIGOROSO):
    - Padrão de Volume: 3 séries para TODOS os exercícios principais.
    - Meta de Repetições: O alvo padrão deve ser 15 repetições (foco em hipertrofia/resistência calistênica).
    - Exceções: 
      - Exercícios muito difíceis (ex: Pull-ups para iniciantes): use 5-8 reps.
      - Isometrias: use segundos.
    - Indique explicitamente "3x15" (ou o alvo ajustado) na descrição ou metas do exercício.
    - As rotinas devem seguir os princípios de sobrecarga progressiva.
    
    Forneça 5 a 7 exercícios por rotina.
  `;

  const client = getAI();
  if (!client) {
    // Use offline generator when no API key is provided (funciona sem custos)
    return Promise.resolve(generateRoutineLocal(profile, splitType));
  }

  try {
    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            routines: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Nome do treino (ex: Upper A)" },
                  description: { type: Type.STRING, description: "Breve explicação. Mencione o padrão de reps (ex: 'Foco em força, 3x15')" },
                  exercises: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        muscleGroup: { type: Type.STRING },
                        description: { type: Type.STRING, description: "Dica de execução." },
                        targetSets: { type: Type.NUMBER },
                        targetReps: { type: Type.STRING, description: "Ex: '15', '8-12' ou 'Max'" },
                        restSeconds: { type: Type.NUMBER },
                      },
                      required: ["name", "muscleGroup", "targetSets", "targetReps", "restSeconds"]
                    }
                  }
                },
                required: ["name", "exercises"]
              }
            }
          }
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      
      if (!data.routines || !Array.isArray(data.routines)) {
         throw new Error("Invalid format returned from AI");
      }

      // Map to ensure IDs exist
      return data.routines.map((r: any) => ({
        id: crypto.randomUUID(),
        name: r.name,
        description: r.description || `Treino focado em ${profile.goal}`,
        exercises: r.exercises.map((ex: any) => ({
          ...ex,
          id: crypto.randomUUID()
        }))
      }));
    }
    throw new Error("No data returned from AI");

  } catch (error) {
    console.error("Erro ao gerar rotina:", error);
    throw error;
  }
};

export const suggestProgression = async (exerciseName: string, recentLogs: string, goal: Goal): Promise<string> => {
  const model = "gemini-2.5-flash";
  
  const prompt = `
    Estou treinando calistenia com foco em ${goal}.
    Meu exercício atual é: ${exerciseName}.
    Meu desempenho recente foi: ${recentLogs}.
    
    O exercício está ficando fácil (já passo de 15 repetições com facilidade) ou estou estagnado.
    Qual é a próxima progressão lógica (exercício mais difícil) ou técnica de intensificação que eu devo usar?
    Seja direto e técnico.
  `;

  const client = getAI();
  if (!client) {
    return Promise.resolve(suggestProgressionLocal(exerciseName, recentLogs, goal));
  }

  try {
    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        maxOutputTokens: 300,
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    return response.text || "Não foi possível gerar uma sugestão no momento.";
  } catch (error) {
    console.error("Erro ao sugerir progressão:", error);
    return "Erro ao conectar com o treinador IA.";
  }
};

export const getExerciseVariations = async (currentExercise: Exercise, goal: Goal): Promise<Exercise[]> => {
  const model = "gemini-2.5-flash";
  const prompt = `
    O atleta está achando o exercício "${currentExercise.name}" muito fácil.
    O objetivo é: ${goal}.
    Dados atuais do exercício: ${currentExercise.targetSets} séries, ${currentExercise.targetReps} reps.
    
    Sugira 3 variações mais difíceis (progressões diretas na calistenia) para substituir este exercício.
    Mantenha o grupo muscular principal.
  `;

    const client = getAI();
    if (!client) return Promise.resolve(getVariationsLocal(currentExercise));

    try {
    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            variations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  muscleGroup: { type: Type.STRING },
                  description: { type: Type.STRING, description: "Por que essa variação é mais difícil?" },
                  targetSets: { type: Type.NUMBER },
                  targetReps: { type: Type.STRING },
                  restSeconds: { type: Type.NUMBER }
                },
                required: ["name", "muscleGroup", "description", "targetSets", "targetReps", "restSeconds"]
              }
            }
          }
        }
      }
    });

    if(response.text) {
      const data = JSON.parse(response.text);
      return data.variations.map((v: any) => ({
        ...v,
        id: crypto.randomUUID()
      }));
    }
    return [];
    } catch(e) {
      console.error(e);
      return [];
    }
};

export const getQuickTip = async (context: string): Promise<string> => {
    const model = "gemini-2.5-flash";
  const client = getAI();
  if (!client) return quickTips[Math.floor(Math.random() * quickTips.length)];
  try {
    const response = await client.models.generateContent({
      model,
      contents: `Dê uma dica muito curta (máximo 2 frases) sobre calistenia relacionada a: ${context}.`,
    });
    return response.text || quickTips[Math.floor(Math.random() * quickTips.length)];
  } catch (e) {
    return quickTips[Math.floor(Math.random() * quickTips.length)];
  }
}