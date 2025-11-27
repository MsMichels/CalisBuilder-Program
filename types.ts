
export enum Difficulty {
  BEGINNER = 'Iniciante',
  INTERMEDIATE = 'Intermediário',
  ADVANCED = 'Avançado'
}

export enum Goal {
  STRENGTH = 'Força',
  HYPERTROPHY = 'Hipertrofia',
  ENDURANCE = 'Resistência',
  SKILL = 'Skills (Planche, Front Lever, etc)'
}

export interface SetLog {
  reps: number;
  weightAdded?: number; // kg
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  description?: string;
  videoUrl?: string; // Optional link to tutorial
  targetSets: number;
  targetReps: string; // e.g. "8-12" or "Max"
  restSeconds: number;
}

export interface WorkoutRoutine {
  id: string;
  name: string;
  description: string;
  exercises: Exercise[];
}

export interface WorkoutSession {
  id: string;
  routineId: string;
  date: string; // ISO string
  durationSeconds: number;
  logs: Record<string, SetLog[]>; // Key is exercise ID
  logsAttributes?: Record<string, any>; // Flexible storage for future needs
  notes?: string;
}

export interface UserProfile {
  name: string;
  level: Difficulty;
  goal: Goal;
  availableEquipment: string[]; // e.g., 'Pull-up Bar', 'Rings', 'Parallettes'
  trainingDaysPerWeek?: number; // Preference for scheduler
}

export interface ScheduleEntry {
  date: string; // YYYY-MM-DD
  type: 'workout' | 'rest';
  routineId?: string; // If workout
  completed?: boolean;
}
