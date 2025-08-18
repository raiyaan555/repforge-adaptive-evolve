import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Plus, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Exercise {
  name: string;
  sets: number;
  reps: number;
  restTime?: string;
}

interface WorkoutStructure {
  [day: string]: {
    muscleGroup: string;
    exercises: Exercise[];
  }[];
}

interface WorkoutLog {
  exercise: string;
  muscleGroup: string;
  plannedSets: number;
  plannedReps: number;
  actualReps: number[];
  weights: number[];
  rpe: number[];
  completed: boolean;
  currentSets: number;
}

interface MuscleGroupFeedback {
  pumpLevel: 'none' | 'medium' | 'amazing';
  isSore: boolean;
  canAddSets: boolean;
}

export function WorkoutLog() {
  const { workoutId } = useParams<{ workoutId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [workout, setWorkout] = useState<any>(null);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentDay, setCurrentDay] = useState(1);
  const [loading, setLoading] = useState(true);

  // MPC Feedback Modal
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    muscleGroup: string;
    exercises: WorkoutLog[];
  }>({ isOpen: false, muscleGroup: '', exercises: [] });
  
  const [feedback, setFeedback] = useState<MuscleGroupFeedback>({
    pumpLevel: 'medium',
    isSore: false,
    canAddSets: false
  });

  // ✅ FIX: SC Modal with explicit value state to reset between muscle groups
  const [scModal, setScModal] = useState<{
    isOpen: boolean;
    muscleGroup: string;
    pendingGroups: string[];
    resolve: (value: string | null) => void;
  }>({ isOpen: false, muscleGroup: '', pendingGroups: [], resolve: () => {} });

  // ✅ FIX: Add separate state for current soreness selection
  const [currentSorenessValue, setCurrentSorenessValue] = useState<string>('');

  const [completedMuscleGroups, setCompletedMuscleGroups] = useState<Set<string>>(new Set());
  const [muscleGroupFeedbacks, setMuscleGroupFeedbacks] = useState<Map<string, MuscleGroupFeedback>>(new Map());

  // ✅ FIXED: Single useEffect with proper cleanup to prevent race conditions
  useEffect(() => {
    let isMounted = true;
    let isInitializing = false;
    
    const initializeAll = async () => {
      if (!user || !workoutId || isInitializing) return;
      
      isInitializing = true;
      setLoading(true);
      
      console.log('🔍 DEBUG - Starting initialization...');
      console.log('🔍 DEBUG - User:', user?.id);
      console.log('🔍 DEBUG - WorkoutId:', workoutId);
      
      try {
        // 1. Load workout data first
        console.log('🔍 DEBUG - Loading workout data...');
        const workoutData = await loadWorkout();
        if (!isMounted || !workoutData) {
          console.log('🔍 DEBUG - No workout data or component unmounted');
          return;
        }
        
        // 2. Load active workout info (week/day)
        console.log('🔍 DEBUG - Loading active workout info...');
        const activeInfo = await loadActiveWorkoutInfo();
        if (!isMounted) {
          console.log('🔍 DEBUG - Component unmounted after loading active info');
          return;
        }
        
        // ✅ FIX: Use actual values from database instead of state
        const actualWeek = activeInfo?.current_week || 1;
        const actualDay = activeInfo?.current_day || 1;
        
        console.log('🔍 DEBUG - Using actual week/day values:', actualWeek, actualDay);
        
        // ✅ CRITICAL FIX: Stop loading BEFORE initializing workout logs
        // This allows the soreness modal to show properly
        if (isMounted) {
          setLoading(false);
          console.log('🔍 DEBUG - Loading stopped before workout logs initialization');
        }
        
        // 3. Initialize workout logs with actual values (may show modal)
        console.log('🔍 DEBUG - Initializing workout logs...');
        await initializeWorkoutLogs(workoutData, actualWeek, actualDay);
        
        // 4. Reset state for new workout
        if (isMounted) {
          setCompletedMuscleGroups(new Set());
          setMuscleGroupFeedbacks(new Map());
          console.log('🔍 DEBUG - State reset complete');
        }
      } catch (error) {
        console.error('🔍 DEBUG - Initialization failed:', error);
        if (isMounted) {
          toast({
            title: "Error",
            description: "Failed to initialize workout",
            variant: "destructive"
          });
        }
      } finally {
        if (isMounted) {
          isInitializing = false;
          console.log('🔍 DEBUG - Initialization complete');
        }
      }
    };
    
    initializeAll();
    
    return () => { 
      isMounted = false; 
      isInitializing = false;
      console.log('🔍 DEBUG - Component cleanup');
    };
  }, [user, workoutId]);

  const loadWorkout = async () => {
    try {
      console.log('🔍 DEBUG - Querying default_workouts...');
      // Load workout from either default_workouts or custom_workouts
      let { data: defaultWorkout } = await supabase
        .from('default_workouts')
        .select('*')
        .eq('id', workoutId)
        .maybeSingle();

      if (!defaultWorkout) {
        console.log('🔍 DEBUG - No default workout found, trying custom_workouts...');
        const { data: customWorkout } = await supabase
          .from('custom_workouts')
          .select('*')
          .eq('id', workoutId)
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (customWorkout) {
          defaultWorkout = customWorkout;
          console.log('🔍 DEBUG - Found custom workout:', customWorkout.name);
        }
      } else {
        console.log('🔍 DEBUG - Found default workout:', defaultWorkout.name);
      }

      if (defaultWorkout) {
        setWorkout(defaultWorkout);
        console.log('🔍 DEBUG - Workout structure:', defaultWorkout.workout_structure);
        console.log('🔍 DEBUG - Workout duration:', defaultWorkout.duration_weeks, 'weeks');
        return defaultWorkout;
      }
      
      console.log('🔍 DEBUG - No workout found');
      return null;
    } catch (error) {
      console.error('🔍 DEBUG - Error loading workout:', error);
      return null;
    }
  };

  const loadActiveWorkoutInfo = async () => {
    try {
      console.log('🔍 DEBUG - Querying active_workouts...');
      const { data: activeWorkout } = await supabase
        .from('active_workouts')
        .select('current_week, current_day')
        .eq('user_id', user.id)
        .eq('workout_id', workoutId)
        .maybeSingle();
        
      if (activeWorkout) {
        console.log('🔍 DEBUG - Loading active workout info - Week:', activeWorkout.current_week, 'Day:', activeWorkout.current_day);
        setCurrentWeek(activeWorkout.current_week);
        setCurrentDay(activeWorkout.current_day);
        return activeWorkout;
      } else {
        console.log('🔍 DEBUG - No active workout found - using defaults');
      }
      return null;
    } catch (error) {
      console.error('🔍 DEBUG - Error loading active workout info:', error);
      return null;
    }
  };

  // ✅ FIX: Updated sequential SC prompting with proper value reset
  const promptForSoreness = useCallback(async (muscleGroups: string[]): Promise<Record<string, string>> => {
    console.log('🔍 DEBUG - promptForSoreness called with:', muscleGroups);
    const results: Record<string, string> = {};
    
    for (let i = 0; i < muscleGroups.length; i++) {
      const currentGroup = muscleGroups[i];
      console.log(`🔍 DEBUG - Processing soreness for: ${currentGroup} (${i + 1}/${muscleGroups.length})`);
      
      // ✅ FIX: Reset soreness value for each new muscle group
      setCurrentSorenessValue('');
      
      const result = await new Promise<string | null>((resolve) => {
        console.log(`🔍 DEBUG - Setting scModal state for ${currentGroup}`);
        console.log(`🔍 DEBUG - Modal will be open: true`);
        setScModal({
          isOpen: true,
          muscleGroup: currentGroup,
          pendingGroups: muscleGroups.slice(i + 1),
          resolve
        });
      });
      
      console.log(`🔍 DEBUG - Received result for ${currentGroup}:`, result);
      
      if (result) {
        results[currentGroup] = result;
      }
      
      // Close modal and add small delay for better UX
      console.log(`🔍 DEBUG - Closing modal for ${currentGroup}`);
      setScModal(prev => ({ ...prev, isOpen: false }));
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('🔍 DEBUG - Final soreness results:', results);
    return results;
  }, []);

  // ✅ FIX: Updated function signature to accept actual week/day values
  const initializeWorkoutLogs = async (workoutData: any, actualWeek: number, actualDay: number) => {
    const structure = workoutData.workout_structure as WorkoutStructure;
    console.log('🔍 DEBUG - Workout structure:', structure);
    console.log('🔍 DEBUG - Actual week passed:', actualWeek);
    console.log('🔍 DEBUG - Actual day passed:', actualDay);
    
    const dayKey = `day${actualDay}`;
    const dayWorkout = structure[dayKey] || [];
    
    console.log('🔍 DEBUG - Day key:', dayKey);
    console.log('🔍 DEBUG - Day workout:', dayWorkout);
    console.log('🔍 DEBUG - Day workout length:', dayWorkout.length);
    
    // Create base logs from template
    const baseLogs: WorkoutLog[] = [];
    for (const mg of dayWorkout) {
      console.log('🔍 DEBUG - Processing muscle group:', mg.muscleGroup);
      console.log('🔍 DEBUG - Exercises in group:', mg.exercises);
      for (const ex of mg.exercises) {
        const defaultSets = ex.sets || 2;
        baseLogs.push({
          exercise: ex.name,
          muscleGroup: mg.muscleGroup,
          plannedSets: defaultSets,
          plannedReps: ex.reps || 8,
          actualReps: Array(defaultSets).fill(0),
          weights: Array(defaultSets).fill(0),
          rpe: Array(defaultSets).fill(7),
          completed: false,
          currentSets: defaultSets,
        });
        console.log(`🔍 DEBUG - Added exercise: ${ex.name} to ${mg.muscleGroup}`);
      }
    }

    console.log('🔍 DEBUG - Total baseLogs created:', baseLogs.length);

    try {
      const muscleGroups = Array.from(new Set(baseLogs.map(l => l.muscleGroup)));
      console.log('🔍 DEBUG - Unique muscle groups for today:', muscleGroups);
      console.log('🔍 DEBUG - Actual week before SC check:', actualWeek);
      
      // ✅ FIXED: Sequential SC prompting for multiple muscle groups using actual week
      const scGroupsToAsk: string[] = [];
      
      for (const mg of muscleGroups) {
        let shouldAsk = actualWeek >= 2;
        console.log(`🔍 DEBUG - ${mg}: actualWeek (${actualWeek}) >= 2? ${shouldAsk}`);
        
        if (!shouldAsk && actualWeek === 1) {
          // Check if this muscle group was trained earlier in the same week
          console.log(`🔍 DEBUG - Checking previous sessions for ${mg} in week ${actualWeek}, day < ${actualDay}`);
          const { data: sameWeek } = await supabase
            .from('mesocycle')
            .select('id, day_number')
            .eq('user_id', user.id)
            .eq('plan_id', workoutId)
            .eq('week_number', actualWeek)
            .eq('muscle_group', mg)
            .lt('day_number', actualDay);
          
          console.log(`🔍 DEBUG - Found ${(sameWeek || []).length} previous sessions for ${mg}:`, sameWeek);
          shouldAsk = (sameWeek || []).length > 0;
        }
        
        if (shouldAsk) {
          scGroupsToAsk.push(mg);
          console.log(`🔍 DEBUG - ✅ ADDED ${mg} to soreness check list`);
        } else {
          console.log(`🔍 DEBUG - ❌ SKIPPED ${mg} - shouldAsk = false`);
        }
        
        console.log(`🔍 DEBUG - ${mg}: shouldAsk=${shouldAsk} (week=${actualWeek})`);
      }

      console.log('🔍 DEBUG - Final scGroupsToAsk array:', scGroupsToAsk);
      console.log('🔍 DEBUG - scGroupsToAsk.length:', scGroupsToAsk.length);

      let scResults: Record<string, string> = {};

      if (scGroupsToAsk.length > 0) {
        console.log('🔍 DEBUG - ✅ CALLING promptForSoreness with groups:', scGroupsToAsk);
        
        // Ask for soreness sequentially if needed
        scResults = await promptForSoreness(scGroupsToAsk);
        console.log('🔍 DEBUG - ✅ SC Results received:', scResults);
      } else {
        console.log('🔍 DEBUG - ❌ NO GROUPS TO ASK - scGroupsToAsk is empty');
      }

      // Save SC results to database
      for (const [mg, sc] of Object.entries(scResults)) {
        console.log(`🔍 DEBUG - Saving soreness result: ${mg} = ${sc}`);
        await supabase.from('muscle_soreness').insert({
          user_id: user.id,
          workout_date: new Date().toISOString().split('T')[0],
          muscle_group: mg,
          soreness_level: sc,
          healed: sc === 'none'
        });
      }

      // Load previous week data with better error handling
      const prevWeek = actualWeek - 1;
      let prevRows: any[] = [];
      
      console.log(`🔍 DEBUG - Looking for previous week data (week ${prevWeek})`);
      
      if (prevWeek >= 1 && user) {
        try {
          const { data: rows, error } = await supabase
            .from('mesocycle')
            .select('exercise_name, muscle_group, actual_sets, actual_reps, weight_used, rpe, pump_level, day_number')
            .eq('user_id', user.id)
            .eq('plan_id', workoutId)
            .eq('week_number', prevWeek)
            .in('muscle_group', muscleGroups);
            
          if (error) throw error;
          prevRows = rows || [];
          console.log(`🔍 DEBUG - Loaded ${prevRows.length} previous week records`);
          console.log('🔍 DEBUG - Previous week data:', prevRows);
        } catch (error) {
          console.error('🔍 DEBUG - Failed to load previous week data:', error);
          prevRows = [];
        }
      } else {
        console.log(`🔍 DEBUG - Skipping previous week data (prevWeek=${prevWeek}, user=${!!user})`);
      }

      // ✅ FIXED: Corrected mapPump function with proper comparison operators
      const mapPump = (p?: string) => {
        if (!p) return 'medium';
        if (p === 'negligible' || p === 'low' || p === 'none') return 'none';
        if (p === 'moderate' || p === 'medium') return 'medium';
        return 'amazing';
      };

      const pumpByGroup: Record<string, 'none'|'medium'|'amazing'> = {};
      for (const mg of muscleGroups) {
        // Get most recent pump level for this muscle group (across all exercises)
        const mgRows = prevRows.filter(r => r.muscle_group === mg && r.pump_level);
        console.log(`🔍 DEBUG - Found ${mgRows.length} pump records for ${mg}`);
        if (mgRows.length > 0) {
          // Sort by day_number descending and take the first (most recent)
          const recent = mgRows.sort((a, b) => (b.day_number || 0) - (a.day_number || 0))[0];
          pumpByGroup[mg] = mapPump(recent.pump_level);
          console.log(`🔍 DEBUG - ${mg} previous pump: ${recent.pump_level} → mapped to: ${pumpByGroup[mg]}`);
        } else {
          pumpByGroup[mg] = 'medium';
          console.log(`🔍 DEBUG - ${mg} no previous pump data → defaulted to: medium`);
        }
      }

      // ✅ FIXED: Sets adjustment function with proper comparison operators
      const setsAdjustment = (
        sc: 'none'|'medium'|'very_sore'|'extremely_sore'|undefined,
        pump: 'none'|'medium'|'amazing'
      ) => {
        if (!sc) return 0;
        if (sc === 'extremely_sore') return -1;
        if (sc === 'none' && pump === 'none') return 3;
        if (sc === 'none' && pump === 'medium') return 2;
        if (sc === 'none' && pump === 'amazing') return 1;
        if (sc === 'medium' && pump === 'none') return 1;
        if (sc === 'medium' && pump === 'medium') return 1;
        if (sc === 'medium' && pump === 'amazing') return 1;
        if (sc === 'very_sore') return 0;
        return 0;
      };

      // ✅ FIXED: Better exercise mapping for multiple exercises per muscle group
      const prevByExercise = new Map<string, any>();
      prevRows
        .sort((a,b) => (b.day_number||0) - (a.day_number||0))
        .forEach(r => { 
          if (!prevByExercise.has(r.exercise_name)) {
            prevByExercise.set(r.exercise_name, r); 
            console.log(`🔍 DEBUG - Mapped previous data for exercise: ${r.exercise_name}`);
          }
        });

      console.log(`🔍 DEBUG - Previous exercise data mapped for ${prevByExercise.size} exercises`);

      // ✅ FIX: Enhanced data validation to prevent failures
      const safeGetArrayValue = (arr: any, index: number, fallback: any = 0) => {
        if (!Array.isArray(arr)) {
          console.log(`🔍 DEBUG - Warning: Expected array but got ${typeof arr}:`, arr);
          return fallback;
        }
        if (index >= arr.length) {
          console.log(`🔍 DEBUG - Warning: Index ${index} out of bounds for array length ${arr.length}`);
          return arr[arr.length - 1] || fallback;
        }
        return arr[index] || fallback;
      };

      // Apply progression logic to each exercise
      const updatedLogs = baseLogs.map(log => {
        const prev = prevByExercise.get(log.exercise);
        let newLog = { ...log };
        
        console.log(`🔍 DEBUG - Processing ${log.exercise} (${log.muscleGroup})`);
        console.log(`🔍 DEBUG - Has previous data: ${!!prev}`);
        
        // ✅ FIXED: Deload logic (final week - reduce to 1/3 except if 1)
        const isDeloadWeek = actualWeek === workoutData.duration_weeks;
        console.log(`🔍 DEBUG - Is deload week: ${isDeloadWeek} (week ${actualWeek}/${workoutData.duration_weeks})`);
        
        if (prev) {
          let baseSets = prev.actual_sets || log.currentSets;
          console.log(`🔍 DEBUG - Base sets from previous: ${baseSets}`);
          
          if (isDeloadWeek) {
            // ✅ DELOAD: reduce to 1/3 of sets and reps, minimum 1
            const deloadSets = Math.max(1, Math.round(baseSets * (1/3)));
            newLog.plannedSets = deloadSets;
            newLog.currentSets = deloadSets;
            
            // ✅ FIX: Safe access to previous reps with validation
            const prevReps = safeGetArrayValue(prev.actual_reps, 0, newLog.plannedReps);
            const deloadReps = Math.max(1, Math.round(prevReps * (1/3)));
            newLog.plannedReps = deloadReps;
            
            console.log(`🔍 DEBUG - DELOAD: ${log.exercise} - Sets: ${baseSets} → ${deloadSets}, Reps: ${prevReps} → ${deloadReps}`);
          } else if (actualWeek >= 2) {
            // Normal progression using SC + MPC
            const sc = scResults[log.muscleGroup] as any;
            const pump = pumpByGroup[log.muscleGroup] || 'medium';
            const setsAdd = setsAdjustment(sc, pump);
            const targetSets = Math.max(1, baseSets + setsAdd);
            
            newLog.plannedSets = targetSets;
            newLog.currentSets = targetSets;
            
            console.log(`🔍 DEBUG - PROGRESSION: ${log.exercise}: ${baseSets} + ${setsAdd} = ${targetSets} sets (SC:${sc}, MPC:${pump})`);
          } else {
            console.log(`🔍 DEBUG - Week 1, no progression applied for ${log.exercise}`);
          }

          // ✅ FIX: Safe prefill weights with proper array handling
          newLog.weights = Array.from({ length: newLog.currentSets }, (_, i) => {
            return safeGetArrayValue(prev.weight_used, i, prev.weight_used?.[0] || 0);
          });
          console.log(`🔍 DEBUG - Prefilled weights for ${log.exercise}:`, newLog.weights);

          // ✅ FIX: Safe prefill reps with proper validation
          if (!isDeloadWeek && prev.actual_reps && prev.rpe) {
            const prevReps = safeGetArrayValue(prev.actual_reps, 0, newLog.plannedReps);
            const firstRpe = safeGetArrayValue(prev.rpe, 0, 9);
            const repIncrease = firstRpe <= 8 ? 1 : 0;
            newLog.plannedReps = prevReps + repIncrease;
            console.log(`🔍 DEBUG - Rep progression: ${prevReps} + ${repIncrease} = ${newLog.plannedReps} (RPE was ${firstRpe})`);
          }

          // Resize arrays to match current sets
          newLog.actualReps = Array.from({ length: newLog.currentSets }, () => 0);
          newLog.rpe = Array.from({ length: newLog.currentSets }, () => 7);
          
        } else {
          console.log(`🔍 DEBUG - No previous data for ${log.exercise}`);
          // No previous data - handle deload and new exercises
          if (isDeloadWeek) {
            // ✅ DELOAD: reduce to 1/3 of sets and reps, minimum 1
            const deloadSets = Math.max(1, Math.round(newLog.currentSets * (1/3)));
            const deloadReps = Math.max(1, Math.round(newLog.plannedReps * (1/3)));
            newLog.plannedSets = deloadSets;
            newLog.currentSets = deloadSets;
            newLog.plannedReps = deloadReps;
            
            console.log(`🔍 DEBUG - DELOAD (no prev): ${log.exercise} - Sets: ${log.currentSets} → ${deloadSets}, Reps: ${log.plannedReps} → ${deloadReps}`);
          } else if (actualWeek >= 2) {
            // Apply SC + MPC even without previous data
            const sc = scResults[log.muscleGroup] as any;
            const pump = pumpByGroup[log.muscleGroup] || 'medium';
            const setsAdd = setsAdjustment(sc, pump);
            const targetSets = Math.max(1, newLog.currentSets + setsAdd);
            
            newLog.plannedSets = targetSets;
            newLog.currentSets = targetSets;
            
            console.log(`🔍 DEBUG - PROGRESSION (no prev): ${log.exercise}: ${newLog.currentSets} + ${setsAdd} = ${targetSets} sets`);
          }
          
          // Initialize arrays
          newLog.actualReps = Array.from({ length: newLog.currentSets }, () => 0);
          newLog.weights = Array.from({ length: newLog.currentSets }, () => 0);
          newLog.rpe = Array.from({ length: newLog.currentSets }, () => 7);
        }
        
        console.log(`🔍 DEBUG - Final ${log.exercise}: ${newLog.currentSets} sets, ${newLog.plannedReps} reps`);
        return newLog;
      });

      console.log('🔍 DEBUG - Final initialized logs:', updatedLogs);
      setWorkoutLogs(updatedLogs);
      
    } catch (e) {
      console.error('🔍 DEBUG - Prefill initialization failed:', e);
      setWorkoutLogs(baseLogs);
    }
  };

  // ✅ FIXED: Use functional state updates to prevent race conditions
  const updateSetData = (exerciseIndex: number, setIndex: number, field: 'reps' | 'weight' | 'rpe', value: number) => {
    setWorkoutLogs(prevLogs => {
      const updatedLogs = [...prevLogs];
      const exercise = updatedLogs[exerciseIndex];
      
      if (!exercise || setIndex < 0 || setIndex >= exercise.currentSets) return prevLogs;
      
      // Ensure arrays are properly sized
      while (exercise.actualReps.length < exercise.currentSets) {
        exercise.actualReps.push(0);
      }
      while (exercise.weights.length < exercise.currentSets) {
        exercise.weights.push(0);
      }
      while (exercise.rpe.length < exercise.currentSets) {
        exercise.rpe.push(7);
      }
      
      // Validate and update value
      if (field === 'rpe' && (value < 1 || value > 10)) {
        toast({
          title: "Invalid RPE",
          description: "RPE must be between 1 and 10",
          variant: "destructive"
        });
        return prevLogs;
      }
      
      const safeValue = isNaN(value) || value < 0 ? (field === 'rpe' ? 7 : 0) : value;
      
      if (field === 'reps') exercise.actualReps[setIndex] = safeValue;
      else if (field === 'weight') exercise.weights[setIndex] = safeValue;
      else if (field === 'rpe') exercise.rpe[setIndex] = safeValue;
      
      // Update completion status
      exercise.completed = isExerciseCompleted(exercise);
      
      return updatedLogs;
    });
  };

  // ✅ FIXED: Use functional state updates
  const addSet = (exerciseIndex: number) => {
    setWorkoutLogs(prevLogs => {
      const updatedLogs = [...prevLogs];
      const exercise = updatedLogs[exerciseIndex];
      
      exercise.currentSets++;
      exercise.actualReps.push(0);
      exercise.weights.push(exercise.weights[exercise.weights.length - 1] || 0);
      exercise.rpe.push(7);
      exercise.completed = false;
      
      return updatedLogs;
    });
  };

  // ✅ FIXED: Use functional state updates
  const removeSet = (exerciseIndex: number) => {
    setWorkoutLogs(prevLogs => {
      const updatedLogs = [...prevLogs];
      const exercise = updatedLogs[exerciseIndex];
      
      if (exercise.currentSets <= 1) return prevLogs;
      
      exercise.currentSets--;
      exercise.actualReps.pop();
      exercise.weights.pop();
      exercise.rpe.pop();
      exercise.completed = false;
      
      return updatedLogs;
    });
  };

  const isExerciseCompleted = (exercise: WorkoutLog) => {
    const requireRpe = currentWeek === 1;
    for (let i = 0; i < exercise.currentSets; i++) {
      if (!exercise.actualReps[i] || exercise.actualReps[i] === 0 ||
          !exercise.weights[i] || exercise.weights[i] === 0) {
        return false;
      }
      if (requireRpe && (!exercise.rpe[i] || exercise.rpe[i] < 1 || exercise.rpe[i] > 10)) {
        return false;
      }
    }
    return true;
  };

  const getMuscleGroupExercises = (muscleGroup: string) => {
    return workoutLogs.filter(log => log.muscleGroup === muscleGroup);
  };

  const getUniqueMuscleGroups = () => {
    return Array.from(new Set(workoutLogs.map(log => log.muscleGroup)));
  };

  const handleMuscleGroupComplete = (muscleGroup: string) => {
    const exercises = getMuscleGroupExercises(muscleGroup);
    console.log('Opening MPC feedback for:', muscleGroup, 'with', exercises.length, 'exercises');
    
    setFeedbackModal({
      isOpen: true,
      muscleGroup,
      exercises
    });
  };

  const saveMuscleGroupFeedback = async () => {
    try {
      const { muscleGroup, exercises } = feedbackModal;
      console.log('Saving MPC feedback for:', muscleGroup);
      
      // Store feedback using functional state updates
      setMuscleGroupFeedbacks(prev => {
        const copy = new Map(prev);
        copy.set(muscleGroup, feedback);
        return copy;
      });
      setCompletedMuscleGroups(prev => new Set([...prev, muscleGroup]));
      
      // Save pump feedback
      await supabase.from('pump_feedback').insert({
        user_id: user.id,
        workout_date: new Date().toISOString().split('T')[0],
        muscle_group: muscleGroup,
        pump_level: feedback.pumpLevel
      });
      
      // Save all exercises in this muscle group to mesocycle
      for (const exercise of exercises) {
        await supabase.from('mesocycle').insert({
          user_id: user.id,
          plan_id: workoutId,
          workout_name: workout.name,
          week_number: currentWeek,
          day_number: currentDay,
          exercise_name: exercise.exercise,
          muscle_group: exercise.muscleGroup,
          planned_sets: exercise.plannedSets,
          planned_reps: exercise.plannedReps,
          actual_sets: exercise.currentSets,
          actual_reps: exercise.actualReps,
          weight_used: exercise.weights,
          weight_unit: weightUnit,
          rpe: exercise.rpe,
          rir: exercise.rpe.reduce((sum, rpe) => sum + rpe, 0) / exercise.rpe.length,
          pump_level: feedback.pumpLevel,
          is_sore: false,
          can_add_sets: false,
          feedback_given: true
        });
      }

      setFeedbackModal({ isOpen: false, muscleGroup: '', exercises: [] });
      
      // Check if all muscle groups are completed
      const allMuscleGroups = getUniqueMuscleGroups();
      const updatedCompletedGroups = new Set(completedMuscleGroups).add(muscleGroup);
      
      if (updatedCompletedGroups.size === allMuscleGroups.length) {
        await completeWorkoutDay();
      } else {
        toast({
          title: "Muscle Group Complete! 💪",
          description: `${muscleGroup} completed. Complete remaining muscle groups to finish the day.`
        });
      }
    } catch (error) {
      console.error('Error saving muscle group feedback:', error);
      toast({
        title: "Error",
        description: "Failed to save muscle group feedback",
        variant: "destructive"
      });
    }
  };

  const completeWorkoutDay = async () => {
    try {
      // Mark workout as completed
      await supabase.from('workout_calendar').insert({
        user_id: user.id,
        workout_date: new Date().toISOString().split('T')[0],
        status: 'completed',
        workout_summary: {
          exercises: workoutLogs.map(ex => ({
            name: ex.exercise,
            sets: ex.currentSets,
            reps: ex.actualReps,
            weights: ex.weights
          })),
          feedback: Array.from(muscleGroupFeedbacks.entries()).map(([mg, fb]) => ({
            muscle_group: mg,
            pump_level: fb.pumpLevel
          }))
        }
      });

      // Progress to next day/week
      const structure = workout.workout_structure;
      const maxDays = Object.keys(structure).filter(dayKey => {
        const dayWorkout = structure[dayKey];
        return Array.isArray(dayWorkout) && dayWorkout.length > 0;
      }).length;
      
      const nextDay = currentDay < maxDays ? currentDay + 1 : 1;
      const nextWeek = currentDay < maxDays ? currentWeek : currentWeek + 1;
      
      await supabase
        .from('active_workouts')
        .update({
          current_day: nextDay,
          current_week: nextWeek,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('workout_id', workoutId);

      // Check if mesocycle is complete
      if (nextWeek > workout.duration_weeks) {
        await saveCompletedMesocycle();
        
        toast({
          title: "Mesocycle Complete! 🎉",
          description: "Congratulations! You've completed your workout plan."
        });
        
        navigate('/past-mesocycles');
        return;
      } else {
        toast({
          title: "Day Complete! 🎉",
          description: `Great job! Moving to Day ${nextDay}, Week ${nextWeek}`
        });
      }
      
      navigate('/current-mesocycle');
    } catch (error) {
      console.error('Error completing workout day:', error);
      toast({
        title: "Error",
        description: "Failed to complete workout day",
        variant: "destructive"
      });
    }
  };

  const saveCompletedMesocycle = async () => {
    try {
      const { data: activeWorkout } = await supabase
        .from('active_workouts')
        .select('*')
        .eq('user_id', user.id)
        .eq('workout_id', workoutId)
        .maybeSingle();

      if (!activeWorkout) return;

      const { data: mesocycleData } = await supabase
        .from('mesocycle')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_id', workoutId);

      await supabase
        .from('completed_mesocycles')
        .insert({
          user_id: user.id,
          mesocycle_name: workout.name || 'Custom Workout',
          program_type: workout.program_type || 'Custom',
          start_date: new Date(activeWorkout.started_at).toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T'),
          total_weeks: workout.duration_weeks,
          total_days: workout.days_per_week * workout.duration_weeks,
          mesocycle_data: {
            workouts: mesocycleData || [],
            workout_structure: workout.workout_structure
          }
        });

      await supabase
        .from('active_workouts')
        .delete()
        .eq('user_id', user.id)
        .eq('workout_id', workoutId);
    } catch (error) {
      console.error('Error saving completed mesocycle:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Loading workout...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">Workout not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/workouts')}
              className="flex items-center gap-2 w-fit"
              size="sm"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Day {currentDay} - Workout Log</h1>
              <p className="text-muted-foreground text-sm sm:text-base">{workout.name} - Week {currentWeek}</p>
              {currentWeek === workout.duration_weeks && (
                <Badge variant="secondary" className="mt-1">DELOAD WEEK</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-6">
          {getUniqueMuscleGroups().map((muscleGroup) => {
            const exercises = getMuscleGroupExercises(muscleGroup);
            const isCompleted = exercises.every(ex => isExerciseCompleted(ex) && ex.completed);
            const hasCompletedFeedback = completedMuscleGroups.has(muscleGroup);
            
            return (
              <Card key={muscleGroup} className="w-full">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-lg">{muscleGroup}</span>
                    <div className="flex gap-2">
                      {isCompleted && <Badge variant="default" className="text-xs">Completed</Badge>}
                      {hasCompletedFeedback && <Badge variant="secondary" className="text-xs">Feedback Given</Badge>}
                    </div>
                  </CardTitle>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleMuscleGroupComplete(muscleGroup)}
                    disabled={!isCompleted || hasCompletedFeedback}
                    className="w-full sm:w-auto text-xs sm:text-sm"
                  >
                    Complete Group
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 sm:space-y-4">
                    {exercises.map((exercise, exerciseIndex) => {
                      const originalIndex = workoutLogs.findIndex(log => log === exercise);
                      
                      return (
                        <div key={`${muscleGroup}-${exerciseIndex}`} className="border rounded-lg p-3 sm:p-4">
                          <div className="flex items-center justify-between mb-3 sm:mb-4">
                            <h3 className="font-semibold text-base sm:text-lg truncate">{exercise.exercise}</h3>
                          </div>
                        
                          <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addSet(originalIndex)}
                                className="text-xs"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                              </Button>
                              {exercise.currentSets > 1 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeSet(originalIndex)}
                                  className="text-xs"
                                >
                                  <Minus className="h-3 w-3 mr-1" />
                                  Remove
                                </Button>
                              )}
                            </div>
                            <span className="text-xs sm:text-sm text-muted-foreground">
                              Sets: {exercise.currentSets} | Target Reps: {exercise.plannedReps}
                              {currentWeek === workout.duration_weeks && (
                                <Badge variant="outline" className="ml-2 text-xs">DELOAD</Badge>
                              )}
                            </span>
                          </div>
                        
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                            {Array.from({ length: exercise.currentSets }).map((_, setIndex) => (
                              <div key={setIndex} className="border rounded p-2 sm:p-3 bg-card">
                                <Label className="text-xs sm:text-sm font-medium mb-2 block">
                                  Set {setIndex + 1}
                                </Label>
                                <div className="space-y-2">
                                  <div>
                                    <Label className="text-xs text-muted-foreground">
                                      Weight ({weightUnit})
                                    </Label>
                                    <Input
                                      type="number"
                                      value={exercise.weights[setIndex] || ''}
                                      placeholder="e.g. 20"
                                      onChange={(e) => updateSetData(originalIndex, setIndex, 'weight', Number(e.target.value) || 0)}
                                      className="h-8 text-sm"
                                      min="0"
                                      step="0.5"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">
                                      Reps
                                    </Label>
                                    <Input
                                      type="number"
                                      value={exercise.actualReps[setIndex] || ''}
                                      placeholder={String(exercise.plannedReps || '')}
                                      onChange={(e) => updateSetData(originalIndex, setIndex, 'reps', Number(e.target.value) || 0)}
                                      className="h-8 text-sm"
                                      min="1"
                                    />
                                  </div>
                                  {currentWeek === 1 && (
                                    <div>
                                      <Label className="text-xs text-muted-foreground">
                                        RPE (1-10) <span className="text-destructive">*</span>
                                      </Label>
                                      <Input
                                        type="number"
                                        value={exercise.rpe[setIndex] || ''}
                                        placeholder="1-10"
                                        onChange={(e) => {
                                          const value = Number(e.target.value);
                                          if (e.target.value === '' || (value >= 1 && value <= 10)) {
                                            updateSetData(originalIndex, setIndex, 'rpe', value || 7);
                                          }
                                        }}
                                        className="h-8 text-sm"
                                        min="1"
                                        max="10"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* MPC Feedback Modal */}
        <Dialog open={feedbackModal.isOpen} onOpenChange={(open) => setFeedbackModal(prev => ({ ...prev, isOpen: open }))}>
          <DialogContent className="max-w-sm sm:max-w-md mx-4">
            <DialogHeader>
              <DialogTitle className="text-lg">Muscle Group Feedback</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div>
                <Label className="text-sm font-medium mb-3 block">
                  Muscle Pump Calculation (MPC) for {feedbackModal.muscleGroup}
                </Label>
                <RadioGroup
                  value={feedback.pumpLevel}
                  onValueChange={(value) => setFeedback(prev => ({ ...prev, pumpLevel: value as any }))}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="none" id="pump-none" />
                    <Label htmlFor="pump-none">None/Negligible</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="pump-medium" />
                    <Label htmlFor="pump-medium">Medium</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="amazing" id="pump-amazing" />
                    <Label htmlFor="pump-amazing">Amazing</Label>
                  </div>
                </RadioGroup>
              </div>
              <Button onClick={saveMuscleGroupFeedback} className="w-full">
                Save Feedback
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ✅ FIX: SC (Soreness) Modal with proper value reset */}
        <Dialog open={scModal.isOpen} onOpenChange={() => {}}>
          <DialogContent className="max-w-sm sm:max-w-md mx-4">
            <DialogHeader>
              <DialogTitle className="text-lg">Soreness Check</DialogTitle>
              <DialogDescription className="text-sm">
                How sore are you before training {scModal.muscleGroup} today?
                {scModal.pendingGroups.length > 0 && (
                  <span className="text-muted-foreground">
                    <br />({scModal.pendingGroups.length} more muscle groups to assess)
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <RadioGroup 
                value={currentSorenessValue} 
                onValueChange={(value) => {
                  console.log(`🔍 DEBUG - User selected soreness: ${value} for ${scModal.muscleGroup}`);
                  setCurrentSorenessValue(value);
                  scModal.resolve(value);
                }}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="none" id="sc-none" />
                  <Label htmlFor="sc-none">None/Negligible</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="medium" id="sc-medium" />
                  <Label htmlFor="sc-medium">Medium</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="very_sore" id="sc-very-sore" />
                  <Label htmlFor="sc-very-sore">Very Sore</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="extremely_sore" id="sc-extremely-sore" />
                  <Label htmlFor="sc-extremely-sore">Extremely Sore</Label>
                </div>
              </RadioGroup>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
