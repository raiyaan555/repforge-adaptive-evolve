import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Plus, Minus, Info } from 'lucide-react';
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
  console.log('🔍 DEBUG - WorkoutLog component rendering...');
  
  const { workoutId } = useParams<{ workoutId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  console.log('🔍 DEBUG - Component props and hooks:', { workoutId, userId: user?.id });

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

  // ✅ NEW: RPE Info Modal
  const [rpeInfoModal, setRpeInfoModal] = useState(false);

  console.log('🔍 DEBUG - Component state:', {
    workout: workout?.name,
    workoutLogsLength: workoutLogs.length,
    currentWeek,
    currentDay,
    loading,
    scModalOpen: scModal.isOpen
  });

  // ✅ NEW: Function to get target RPE based on week and set position
  const getTargetRPE = (week: number, setIndex: number, totalSets: number) => {
    console.log(`🔍 DEBUG - getTargetRPE called: week=${week}, setIndex=${setIndex}, totalSets=${totalSets}`);
    
    if (week === 1) {
      console.log('🔍 DEBUG - getTargetRPE result: 7 (Week 1)');
      return 7;
    }
    if (week === 7) {
      console.log('🔍 DEBUG - getTargetRPE result: 7 (Deload week)');
      return 7; // Deload week
    }
    
    const isLastSet = setIndex === totalSets - 1;
    console.log(`🔍 DEBUG - isLastSet: ${isLastSet}`);
    
    if (week >= 2 && week <= 3) {
      const rpe = isLastSet ? 9 : 8;
      console.log(`🔍 DEBUG - getTargetRPE result: ${rpe} (Week 2-3)`);
      return rpe;
    }
    if (week >= 4 && week <= 5) {
      const rpe = isLastSet ? 10 : 9;
      console.log(`🔍 DEBUG - getTargetRPE result: ${rpe} (Week 4-5)`);
      return rpe;
    }
    if (week === 6) {
      console.log('🔍 DEBUG - getTargetRPE result: 10 (Week 6)');
      return 10;
    }
    
    console.log('🔍 DEBUG - getTargetRPE result: 7 (fallback)');
    return 7; // fallback
  };

  // ✅ NEW: Input validation helpers
  const validateNumericInput = (value: string, field: 'reps' | 'weight' | 'rpe'): number => {
    console.log(`🔍 DEBUG - validateNumericInput: value="${value}", field="${field}"`);
    
    // Remove non-numeric characters except decimal point
    const cleanValue = value.replace(/[^0-9.]/g, '');
    const numValue = parseFloat(cleanValue);
    
    console.log(`🔍 DEBUG - validateNumericInput: cleanValue="${cleanValue}", numValue=${numValue}`);
    
    if (isNaN(numValue) || numValue < 0) {
      switch (field) {
        case 'rpe': 
          console.log('🔍 DEBUG - validateNumericInput result: 7 (default RPE)');
          return 7; // Default RPE
        case 'reps': 
          console.log('🔍 DEBUG - validateNumericInput result: 1 (minimum reps)');
          return 1; // Minimum reps
        case 'weight': 
          console.log('🔍 DEBUG - validateNumericInput result: 0 (minimum weight)');
          return 0; // Can be 0 for bodyweight
      }
    }
    
    // Apply field-specific constraints
    let result;
    switch (field) {
      case 'rpe': 
        result = Math.min(Math.max(Math.round(numValue), 1), 10);
        break;
      case 'reps': 
        result = Math.min(Math.max(Math.round(numValue), 1), 100);
        break;
      case 'weight': 
        result = Math.min(Math.max(numValue, 0), 999);
        break;
      default:
        result = numValue;
    }
    
    console.log(`🔍 DEBUG - validateNumericInput result: ${result}`);
    return result;
  };

  const ensureArrayIntegrity = (exercise: WorkoutLog): WorkoutLog => {
    console.log(`🔍 DEBUG - ensureArrayIntegrity called for ${exercise.exercise}`);
    console.log(`🔍 DEBUG - Before integrity check:`, {
      currentSets: exercise.currentSets,
      actualRepsLength: exercise.actualReps?.length,
      weightsLength: exercise.weights?.length,
      rpeLength: exercise.rpe?.length
    });
    
    const correctedExercise = { ...exercise };
    const targetLength = correctedExercise.currentSets;
    
    // Ensure all arrays match currentSets length
    correctedExercise.actualReps = Array.from({ length: targetLength }, (_, i) => 
      correctedExercise.actualReps[i] || 0
    );
    correctedExercise.weights = Array.from({ length: targetLength }, (_, i) => 
      correctedExercise.weights[i] || 0
    );
    correctedExercise.rpe = Array.from({ length: targetLength }, (_, i) => 
      correctedExercise.rpe[i] || getTargetRPE(currentWeek, i, targetLength)
    );
    
    console.log(`🔍 DEBUG - After integrity check:`, {
      currentSets: correctedExercise.currentSets,
      actualRepsLength: correctedExercise.actualReps?.length,
      weightsLength: correctedExercise.weights?.length,
      rpeLength: correctedExercise.rpe?.length
    });
    
    return correctedExercise;
  };

  // ✅ FIXED: Single useEffect with proper cleanup to prevent race conditions
  useEffect(() => {
    console.log('🔍 DEBUG - useEffect triggered', { user: user?.id, workoutId });
    
    let isMounted = true;
    let isInitializing = false;
    
    const initializeAll = async () => {
      console.log('🔍 DEBUG - initializeAll called', { user: !!user, workoutId, isInitializing });
      
      if (!user || !workoutId || isInitializing) {
        console.log('🔍 DEBUG - Early return from initializeAll:', { user: !!user, workoutId, isInitializing });
        return;
      }
      
      isInitializing = true;
      setLoading(true);
      
      console.log('🔍 DEBUG - Starting initialization...');
      console.log('🔍 DEBUG - User:', user?.id);
      console.log('🔍 DEBUG - WorkoutId:', workoutId);
      
      try {
        // 1. Load workout data first
        console.log('🔍 DEBUG - Loading workout data...');
        const workoutData = await loadWorkout();
        console.log('🔍 DEBUG - Workout data loaded:', { found: !!workoutData, name: workoutData?.name });
        
        if (!isMounted || !workoutData) {
          console.log('🔍 DEBUG - No workout data or component unmounted');
          return;
        }
        
        // 2. Load active workout info (week/day)
        console.log('🔍 DEBUG - Loading active workout info...');
        const activeInfo = await loadActiveWorkoutInfo();
        console.log('🔍 DEBUG - Active workout info loaded:', activeInfo);
        
        if (!isMounted) {
          console.log('🔍 DEBUG - Component unmounted after loading active info');
          return;
        }
        
        // ✅ FIX: Use actual values from database instead of state
        const actualWeek = activeInfo?.current_week || 1;
        const actualDay = activeInfo?.current_day || 1;
        
        console.log('🔍 DEBUG - Using actual week/day values:', { actualWeek, actualDay });
        
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
        console.error('🔍 DEBUG - Error stack:', error.stack);
        if (isMounted) {
          toast({
            title: "Error",
            description: "Failed to initialize workout. Please refresh and try again.",
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
    console.log('🔍 DEBUG - loadWorkout started');
    
    try {
      console.log('🔍 DEBUG - Querying default_workouts with workoutId:', workoutId);
      
      // Load workout from either default_workouts or custom_workouts
      let { data: defaultWorkout, error: defaultError } = await supabase
        .from('default_workouts')
        .select('*')
        .eq('id', workoutId)
        .maybeSingle();

      console.log('🔍 DEBUG - Default workouts query result:', { data: defaultWorkout, error: defaultError });

      if (!defaultWorkout) {
        console.log('🔍 DEBUG - No default workout found, trying custom_workouts...');
        
        const { data: customWorkout, error: customError } = await supabase
          .from('custom_workouts')
          .select('*')
          .eq('id', workoutId)
          .eq('user_id', user.id)
          .maybeSingle();
        
        console.log('🔍 DEBUG - Custom workouts query result:', { data: customWorkout, error: customError });
        
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
      console.error('🔍 DEBUG - Error details:', error.message, error.code);
      return null;
    }
  };

  const loadActiveWorkoutInfo = async () => {
    console.log('🔍 DEBUG - loadActiveWorkoutInfo started');
    
    try {
      console.log('🔍 DEBUG - Querying active_workouts with:', { userId: user.id, workoutId });
      
      const { data: activeWorkout, error } = await supabase
        .from('active_workouts')
        .select('current_week, current_day')
        .eq('user_id', user.id)
        .eq('workout_id', workoutId)
        .maybeSingle();
        
      console.log('🔍 DEBUG - Active workouts query result:', { data: activeWorkout, error });
        
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
      console.error('🔍 DEBUG - Error details:', error.message, error.code);
      return null;
    }
  };

  // ✅ FIX: Updated sequential SC prompting with proper value reset
  const promptForSoreness = useCallback(async (muscleGroups: string[]): Promise<Record<string, string>> => {
    console.log('🔍 DEBUG - promptForSoreness called with:', muscleGroups);
    const results: Record<string, string> = {};
    
    try {
      for (let i = 0; i < muscleGroups.length; i++) {
        const currentGroup = muscleGroups[i];
        console.log(`🔍 DEBUG - Processing soreness for: ${currentGroup} (${i + 1}/${muscleGroups.length})`);
        
        // ✅ FIX: Reset soreness value for each new muscle group
        setCurrentSorenessValue('');
        console.log(`🔍 DEBUG - Reset currentSorenessValue for ${currentGroup}`);
        
        const result = await new Promise<string | null>((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.log(`🔍 DEBUG - Soreness prompt timeout for ${currentGroup}`);
            reject(new Error('Soreness prompt timeout'));
          }, 60000); // 60 second timeout
          
          console.log(`🔍 DEBUG - Setting scModal state for ${currentGroup}`);
          setScModal({
            isOpen: true,
            muscleGroup: currentGroup,
            pendingGroups: muscleGroups.slice(i + 1),
            resolve: (value) => {
              clearTimeout(timeout);
              console.log(`🔍 DEBUG - Resolve called with value: ${value} for ${currentGroup}`);
              resolve(value);
            }
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
    } catch (error) {
      console.error('🔍 DEBUG - Soreness prompting failed:', error);
      // Continue with empty results rather than failing
    }
    
    console.log('🔍 DEBUG - Final soreness results:', results);
    return results;
  }, []);

  // ✅ NEW: Function to get weekly sets count per muscle group
  const getWeeklySetsByMuscleGroup = async (muscleGroups: string[], actualWeek: number) => {
    console.log('🔍 DEBUG - getWeeklySetsByMuscleGroup called:', { muscleGroups, actualWeek });
    
    const weeklySetsByMuscleGroup: Record<string, number> = {};
    
    try {
      if (!user?.id || !workoutId || !Array.isArray(muscleGroups) || muscleGroups.length === 0) {
        console.log('🔍 DEBUG - Invalid parameters for weekly sets lookup:', { 
          userId: user?.id, 
          workoutId, 
          muscleGroupsArray: Array.isArray(muscleGroups), 
          muscleGroupsLength: muscleGroups?.length 
        });
        muscleGroups.forEach(mg => weeklySetsByMuscleGroup[mg] = 0);
        return weeklySetsByMuscleGroup;
      }

      console.log('🔍 DEBUG - Querying mesocycle table for weekly sets:', {
        userId: user.id,
        planId: workoutId,
        weekNumber: actualWeek,
        muscleGroups
      });

      const { data: weeklyData, error } = await supabase
        .from('mesocycle')
        .select('muscle_group, actual_sets')
        .eq('user_id', user.id)
        .eq('plan_id', workoutId)
        .eq('week_number', actualWeek)
        .in('muscle_group', muscleGroups);
        
      console.log('🔍 DEBUG - Weekly sets query result:', { data: weeklyData, error });
        
      if (error) throw error;
      
      // Calculate total weekly sets per muscle group
      for (const mg of muscleGroups) {
        const mgData = weeklyData?.filter(d => d.muscle_group === mg) || [];
        weeklySetsByMuscleGroup[mg] = mgData.reduce((total, d) => {
          const sets = Number(d.actual_sets) || 0;
          return total + sets;
        }, 0);
        console.log(`🔍 DEBUG - Weekly sets for ${mg}: ${weeklySetsByMuscleGroup[mg]} (from ${mgData.length} records)`);
      }
    } catch (error) {
      console.error('🔍 DEBUG - Failed to load weekly sets data:', error);
      console.error('🔍 DEBUG - Error details:', error.message, error.code);
      // Default to 0 if we can't load data
      for (const mg of muscleGroups) {
        weeklySetsByMuscleGroup[mg] = 0;
      }
    }
    
    console.log('🔍 DEBUG - Final weekly sets by muscle group:', weeklySetsByMuscleGroup);
    return weeklySetsByMuscleGroup;
  };

  // ✅ NEW: Function to find exercise with min/max sets in a muscle group
  const findExerciseForSetAdjustment = (logs: WorkoutLog[], muscleGroup: string, isIncrease: boolean) => {
    console.log('🔍 DEBUG - findExerciseForSetAdjustment called:', { muscleGroup, isIncrease, logsLength: logs.length });
    
    try {
      const mgExercises = logs.filter(log => log?.muscleGroup === muscleGroup);
      console.log(`🔍 DEBUG - Found ${mgExercises.length} exercises for ${muscleGroup}:`, mgExercises.map(ex => ({ name: ex.exercise, sets: ex.currentSets })));
      
      if (mgExercises.length === 0) return null;
      
      let result;
      if (isIncrease) {
        // Find exercise with minimum sets
        result = mgExercises.reduce((min, current) => 
          (current?.currentSets || 0) < (min?.currentSets || 0) ? current : min
        );
        console.log(`🔍 DEBUG - Exercise with minimum sets for increase: ${result.exercise} (${result.currentSets} sets)`);
      } else {
        // Find exercise with maximum sets
        result = mgExercises.reduce((max, current) => 
          (current?.currentSets || 0) > (max?.currentSets || 0) ? current : max
        );
        console.log(`🔍 DEBUG - Exercise with maximum sets for decrease: ${result.exercise} (${result.currentSets} sets)`);
      }
      
      return result;
    } catch (error) {
      console.error('🔍 DEBUG - Error finding exercise for set adjustment:', error);
      return null;
    }
  };

  // ✅ COMPLETELY REWRITTEN: New function to get MOST RECENT occurrence of same exercise
  const getMostRecentExerciseData = async (exerciseName: string, muscleGroup: string, actualWeek: number, actualDay: number) => {
    console.log(`🔍 DEBUG - getMostRecentExerciseData called:`, {
      exerciseName,
      muscleGroup,
      actualWeek,
      actualDay,
      userId: user.id,
      planId: workoutId
    });
    
    try {
      console.log(`🔍 DEBUG - Looking for most recent data for ${exerciseName} (${muscleGroup})`);
      
      // Build the query conditions step by step for better debugging
      const baseConditions = {
        user_id: user.id,
        plan_id: workoutId,
        exercise_name: exerciseName,
        muscle_group: muscleGroup
      };
      
      console.log('🔍 DEBUG - Base query conditions:', baseConditions);
      
      // Create the OR condition for previous occurrences
      const orCondition = `week_number.lt.${actualWeek},and(week_number.eq.${actualWeek},day_number.lt.${actualDay})`;
      console.log('🔍 DEBUG - OR condition:', orCondition);
      
      // Get all previous occurrences of this exact exercise, sorted by most recent first
      console.log('🔍 DEBUG - Executing mesocycle query...');
      const { data: exerciseHistory, error } = await supabase
        .from('mesocycle')
        .select('exercise_name, muscle_group, actual_sets, actual_reps, weight_used, rpe, pump_level, week_number, day_number')
        .eq('user_id', user.id)
        .eq('plan_id', workoutId)
        .eq('exercise_name', exerciseName)
        .eq('muscle_group', muscleGroup)
        .or(orCondition)
        .order('week_number', { ascending: false })
        .order('day_number', { ascending: false })
        .limit(1);
        
      console.log('🔍 DEBUG - Mesocycle query executed:', { data: exerciseHistory, error });
        
      if (error) {
        console.error('🔍 DEBUG - Query error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }
      
      const mostRecent = exerciseHistory?.[0];
      console.log(`🔍 DEBUG - Most recent data for ${exerciseName}:`, mostRecent);
      
      if (mostRecent) {
        console.log(`🔍 DEBUG - Found recent exercise data:`, {
          week: mostRecent.week_number,
          day: mostRecent.day_number,
          sets: mostRecent.actual_sets,
          reps: mostRecent.actual_reps,
          weights: mostRecent.weight_used,
          rpe: mostRecent.rpe
        });
      } else {
        console.log(`🔍 DEBUG - No previous data found for ${exerciseName}`);
      }
      
      return mostRecent || null;
    } catch (error) {
      console.error(`🔍 DEBUG - Failed to get recent data for ${exerciseName}:`, error);
      console.error('🔍 DEBUG - Error stack:', error.stack);
      return null;
    }
  };

  // ✅ NEW: Function to get best performing set metrics
  const getBestSetMetrics = (actualReps: any[], rpe: any[]) => {
    console.log('🔍 DEBUG - getBestSetMetrics called:', { actualReps, rpe });
    
    try {
      if (!Array.isArray(actualReps) || !Array.isArray(rpe) || actualReps.length === 0) {
        console.log('🔍 DEBUG - Invalid input arrays, returning defaults');
        return { bestReps: 0, averageRpe: 7 };
      }

      // Convert to numbers and filter valid data
      const validSets = [];
      for (let i = 0; i < Math.min(actualReps.length, rpe.length); i++) {
        const reps = Number(actualReps[i]) || 0;
        const rpeVal = Number(rpe[i]) || 7;
        if (reps > 0) {
          validSets.push({ reps, rpe: rpeVal });
          console.log(`🔍 DEBUG - Valid set ${i + 1}: ${reps} reps @ RPE ${rpeVal}`);
        }
      }

      if (validSets.length === 0) {
        console.log('🔍 DEBUG - No valid sets found, returning defaults');
        return { bestReps: 0, averageRpe: 7 };
      }

      // Find best performing set (highest reps, or if tied, lowest RPE)
      const bestSet = validSets.reduce((best, current) => {
        if (current.reps > best.reps) return current;
        if (current.reps === best.reps && current.rpe < best.rpe) return current;
        return best;
      });

      // Calculate average RPE across all sets
      const averageRpe = validSets.reduce((sum, set) => sum + set.rpe, 0) / validSets.length;

      const result = { bestReps: bestSet.reps, averageRpe };
      console.log(`🔍 DEBUG - Best set metrics: reps=${bestSet.reps}, avgRPE=${averageRpe.toFixed(1)}`, result);
      return result;
    } catch (error) {
      console.error('🔍 DEBUG - Error calculating best set metrics:', error);
      return { bestReps: 0, averageRpe: 7 };
    }
  };

  // ✅ COMPLETELY REWRITTEN: Enhanced function with proper same-exercise progression
  const initializeWorkoutLogs = async (workoutData: any, actualWeek: number, actualDay: number) => {
    console.log('🔍 DEBUG - initializeWorkoutLogs started:', { workoutData: !!workoutData, actualWeek, actualDay });
    
    try {
      const structure = workoutData?.workout_structure as WorkoutStructure;
      if (!structure) {
        console.error('🔍 DEBUG - No workout structure found');
        return;
      }

      console.log('🔍 DEBUG - Workout structure:', structure);
      console.log('🔍 DEBUG - Actual week passed:', actualWeek);
      console.log('🔍 DEBUG - Actual day passed:', actualDay);
      
      const dayKey = `day${actualDay}`;
      const dayWorkout = structure[dayKey] || [];
      
      console.log('🔍 DEBUG - Day key:', dayKey);
      console.log('🔍 DEBUG - Day workout:', dayWorkout);
      console.log('🔍 DEBUG - Day workout length:', dayWorkout.length);
      
      // Create base logs from template with enhanced validation
      const baseLogs: WorkoutLog[] = [];
      for (const mg of dayWorkout) {
        if (!mg?.muscleGroup || !Array.isArray(mg.exercises)) {
          console.warn('🔍 DEBUG - Invalid muscle group data:', mg);
          continue;
        }

        console.log('🔍 DEBUG - Processing muscle group:', mg.muscleGroup);
        console.log('🔍 DEBUG - Exercises in group:', mg.exercises);
        
        for (const ex of mg.exercises) {
          if (!ex?.name) {
            console.warn('🔍 DEBUG - Invalid exercise data:', ex);
            continue;
          }

          const defaultSets = Math.max(1, Number(ex.sets) || 2);
          const defaultReps = Math.max(1, Number(ex.reps) || 8);
          
          const newLog = {
            exercise: ex.name,
            muscleGroup: mg.muscleGroup,
            plannedSets: defaultSets,
            plannedReps: defaultReps,
            actualReps: Array(defaultSets).fill(0),
            weights: Array(defaultSets).fill(0),
            rpe: Array(defaultSets).fill(getTargetRPE(actualWeek, 0, defaultSets)),
            completed: false,
            currentSets: defaultSets,
          };
          
          baseLogs.push(newLog);
          console.log(`🔍 DEBUG - Added exercise: ${ex.name} to ${mg.muscleGroup}`, newLog);
        }
      }

      if (baseLogs.length === 0) {
        console.error('🔍 DEBUG - No valid exercises found');
        return;
      }

      console.log('🔍 DEBUG - Total baseLogs created:', baseLogs.length);

      const muscleGroups = Array.from(new Set(baseLogs.map(l => l.muscleGroup).filter(Boolean)));
      console.log('🔍 DEBUG - Unique muscle groups for today:', muscleGroups);
      console.log('🔍 DEBUG - Actual week before SC check:', actualWeek);
      
      // ✅ ENHANCED: Improved soreness checking logic
      console.log('🔍 DEBUG - Starting soreness check logic...');
      const scGroupsToAsk: string[] = [];
      
      for (const mg of muscleGroups) {
        console.log(`🔍 DEBUG - Checking soreness requirements for ${mg}`);
        
        let shouldAsk = false;
        
        // Week 2+ always ask if there's previous training
        if (actualWeek >= 2) {
          console.log(`🔍 DEBUG - Week ${actualWeek} >= 2, checking for any previous training for ${mg}`);
          shouldAsk = true;
        } 
        // Week 1 Day 2+ check if trained in previous days of same week
        else if (actualWeek === 1 && actualDay >= 2) {
          console.log(`🔍 DEBUG - Week 1, Day ${actualDay} >= 2, checking previous days for ${mg}`);
          
          // Check workout structure for previous days in Week 1
          for (let d = 1; d < actualDay; d++) {
            const prevDayKey = `day${d}`;
            const prevDayWorkout = structure[prevDayKey] || [];
            const hasMuscleGroup = prevDayWorkout.some((mgData: any) => mgData?.muscleGroup === mg);
            
            console.log(`🔍 DEBUG - Day ${d} has ${mg}? ${hasMuscleGroup}`);
            
            if (hasMuscleGroup) {
              shouldAsk = true;
              console.log(`🔍 DEBUG - Found ${mg} in Day ${d}, will ask for soreness`);
              break;
            }
          }
          
          // Also check mesocycle table for completed data
          if (!shouldAsk) {
            console.log(`🔍 DEBUG - Checking mesocycle table for ${mg} in Week 1, previous days`);
            try {
              const { data: sameWeek, error } = await supabase
                .from('mesocycle')
                .select('id, day_number')
                .eq('user_id', user.id)
                .eq('plan_id', workoutId)
                .eq('week_number', actualWeek)
                .eq('muscle_group', mg)
                .lt('day_number', actualDay);
              
              console.log(`🔍 DEBUG - Mesocycle query for ${mg}:`, { data: sameWeek, error });
              
              if (!error && sameWeek && sameWeek.length > 0) {
                shouldAsk = true;
                console.log(`🔍 DEBUG - Found completed ${mg} sessions in mesocycle table:`, sameWeek);
              }
            } catch (error) {
              console.error(`🔍 DEBUG - Error checking mesocycle for ${mg}:`, error);
            }
          }
        }
        
        console.log(`🔍 DEBUG - Final decision for ${mg}: shouldAsk = ${shouldAsk} (Week ${actualWeek}, Day ${actualDay})`);
        
        if (shouldAsk) {
          scGroupsToAsk.push(mg);
          console.log(`🔍 DEBUG - ✅ ADDED ${mg} to soreness check list`);
        } else {
          console.log(`🔍 DEBUG - ❌ SKIPPED ${mg} - shouldAsk = false`);
        }
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

      // Save SC results to database with error handling
      console.log('🔍 DEBUG - Saving soreness results to database...');
      for (const [mg, sc] of Object.entries(scResults)) {
        try {
          console.log(`🔍 DEBUG - Saving soreness result: ${mg} = ${sc}`);
          const insertResult = await supabase.from('muscle_soreness').insert({
            user_id: user.id,
            workout_date: new Date().toISOString().split('T')[0],
            muscle_group: mg,
            soreness_level: sc,
            healed: sc === 'none'
          });
          console.log(`🔍 DEBUG - Soreness insert result for ${mg}:`, insertResult);
        } catch (error) {
          console.error(`🔍 DEBUG - Failed to save soreness for ${mg}:`, error);
        }
      }

      // ✅ NEW: Get weekly sets count per muscle group
      console.log('🔍 DEBUG - Getting weekly sets by muscle group...');
      const weeklySetsByMuscleGroup = await getWeeklySetsByMuscleGroup(muscleGroups, actualWeek);

      // ✅ NEW: Get previous pump levels for muscle groups (for MPC calculation)
      console.log('🔍 DEBUG - Getting previous pump levels...');
      const pumpByGroup: Record<string, 'none'|'medium'|'amazing'> = {};
      if (actualWeek >= 2) {
        try {
          console.log('🔍 DEBUG - Querying pump_feedback table...');
          const { data: pumpData, error } = await supabase
            .from('pump_feedback')
            .select('muscle_group, pump_level')
            .eq('user_id', user.id)
            .order('workout_date', { ascending: false })
            .limit(50);
            
          console.log('🔍 DEBUG - Pump feedback query result:', { data: pumpData, error });
            
          if (!error && pumpData) {
            for (const mg of muscleGroups) {
              const recentPump = pumpData.find(p => p.muscle_group === mg);
              if (recentPump) {
                const mapped = recentPump.pump_level === 'none' ? 'none' : 
                              recentPump.pump_level === 'amazing' ? 'amazing' : 'medium';
                pumpByGroup[mg] = mapped;
                console.log(`🔍 DEBUG - ${mg} previous pump: ${recentPump.pump_level} → ${mapped}`);
              } else {
                pumpByGroup[mg] = 'medium';
                console.log(`🔍 DEBUG - ${mg} no previous pump data, defaulting to medium`);
              }
            }
          }
        } catch (error) {
          console.error('🔍 DEBUG - Failed to load pump data:', error);
          for (const mg of muscleGroups) {
            pumpByGroup[mg] = 'medium';
          }
        }
      } else {
        console.log('🔍 DEBUG - Week < 2, skipping pump level queries');
      }

      // ✅ FIXED: Sets adjustment function
      const setsAdjustment = (
        sc: 'none'|'medium'|'very_sore'|'extremely_sore'|undefined,
        pump: 'none'|'medium'|'amazing'
      ) => {
        console.log(`🔍 DEBUG - setsAdjustment called: sc=${sc}, pump=${pump}`);
        
        if (!sc) {
          console.log('🔍 DEBUG - setsAdjustment result: 0 (no sc)');
          return 0;
        }
        
        let adjustment;
        if (sc === 'extremely_sore') adjustment = -1;
        else if (sc === 'none' && pump === 'none') adjustment = 3;
        else if (sc === 'none' && pump === 'medium') adjustment = 2;
        else if (sc === 'none' && pump === 'amazing') adjustment = 1;
        else if (sc === 'medium' && pump === 'none') adjustment = 1;
        else if (sc === 'medium' && pump === 'medium') adjustment = 1;
        else if (sc === 'medium' && pump === 'amazing') adjustment = 1;
        else if (sc === 'very_sore') adjustment = 0;
        else adjustment = 0;
        
        console.log(`🔍 DEBUG - setsAdjustment result: ${adjustment}`);
        return adjustment;
      };

      // ✅ NEW: Calculate set adjustments per muscle group first
      console.log('🔍 DEBUG - Calculating set adjustments per muscle group...');
      const muscleGroupAdjustments: Record<string, number> = {};
      for (const mg of muscleGroups) {
        if (actualWeek >= 2) {
          const sc = scResults[mg] as any;
          const pump = pumpByGroup[mg] || 'medium';
          const adjustment = setsAdjustment(sc, pump);
          muscleGroupAdjustments[mg] = adjustment;
          console.log(`🔍 DEBUG - Muscle group ${mg} adjustment: ${adjustment} sets (SC:${sc}, MPC:${pump})`);
        } else {
          muscleGroupAdjustments[mg] = 0;
          console.log(`🔍 DEBUG - Muscle group ${mg}: Week < 2, no adjustment`);
        }
      }

      // ✅ COMPLETELY REWRITTEN: Apply progression logic with SAME EXERCISE focus
      console.log('🔍 DEBUG - Starting exercise progression logic...');
      const updatedLogs = [];
      for (let i = 0; i < baseLogs.length; i++) {
        const log = baseLogs[i];
        console.log(`🔍 DEBUG - Processing exercise ${i + 1}/${baseLogs.length}: ${log.exercise} (${log.muscleGroup})`);
        
        try {
          let newLog = { ...log };
          
          // ✅ FIX: Week 1 should have NO prefills - start completely empty
          if (actualWeek === 1) {
            console.log(`🔍 DEBUG - Week 1: ${log.exercise} - No prefills, starting empty`);
            newLog.weights = Array(newLog.currentSets).fill(0);
            newLog.actualReps = Array(newLog.currentSets).fill(0);
            newLog.rpe = Array(newLog.currentSets).fill(7);
            updatedLogs.push(ensureArrayIntegrity(newLog));
            console.log(`🔍 DEBUG - Week 1 exercise processed: ${log.exercise}`);
            continue;
          }

          // ✅ NEW: Get most recent occurrence of this EXACT exercise
          console.log(`🔍 DEBUG - Looking for recent data for ${log.exercise}...`);
          const recentExercise = await getMostRecentExerciseData(log.exercise, log.muscleGroup, actualWeek, actualDay);
          console.log(`🔍 DEBUG - Recent data for ${log.exercise}:`, recentExercise ? 'Found' : 'Not found');
          
          // ✅ FIXED: Deload logic (final week - reduce to 1/3 except if 1)
          const isDeloadWeek = actualWeek === workoutData.duration_weeks;
          console.log(`🔍 DEBUG - Is deload week: ${isDeloadWeek} (week ${actualWeek}/${workoutData.duration_weeks})`);
          
          if (recentExercise) {
            console.log(`🔍 DEBUG - Processing ${log.exercise} with recent data...`);
            
            let baseSets = Math.max(1, Number(recentExercise.actual_sets) || log.currentSets);
            console.log(`🔍 DEBUG - Base sets from most recent: ${baseSets}`);
            
            if (isDeloadWeek) {
              // ✅ DELOAD: reduce to 1/3 of sets and reps, minimum 1
              const deloadSets = Math.max(1, Math.round(baseSets * (1/3)));
              newLog.plannedSets = deloadSets;
              newLog.currentSets = deloadSets;
              
              // Use best reps from previous performance
              const { bestReps } = getBestSetMetrics(recentExercise.actual_reps, recentExercise.rpe);
              const deloadReps = Math.max(1, Math.round(bestReps * (1/3)));
              newLog.plannedReps = deloadReps;
              
              console.log(`🔍 DEBUG - DELOAD: ${log.exercise} - Sets: ${baseSets} → ${deloadSets}, Reps: ${bestReps} → ${deloadReps}`);
            } else {
              // Just use base sets, muscle group adjustments will be applied later
              newLog.plannedSets = baseSets;
              newLog.currentSets = baseSets;
              console.log(`🔍 DEBUG - Base sets applied: ${log.exercise}: ${baseSets} sets`);
            }

            // ✅ ENHANCED: ALWAYS prefill weights from most recent performance with comprehensive fallbacks
            console.log(`🔍 DEBUG - Processing weights for ${log.exercise}...`);
            const prevWeights = recentExercise.weight_used;
            console.log(`🔍 DEBUG - Previous weights data:`, prevWeights, 'Type:', typeof prevWeights, 'IsArray:', Array.isArray(prevWeights));
            
            if (Array.isArray(prevWeights) && prevWeights.length > 0) {
              // Use actual weights from previous performance
              newLog.weights = Array.from({ length: newLog.currentSets }, (_, i) => {
                const weight = Number(prevWeights[i] || prevWeights[0] || 0);
                return Math.max(0, weight);
              });
              console.log(`🔍 DEBUG - ✅ PREFILLED weights for ${log.exercise}:`, newLog.weights);
            } else {
              // Fallback: try to extract from other formats or use defaults
              const fallbackWeight = Number(prevWeights) || 0;
              newLog.weights = Array(newLog.currentSets).fill(Math.max(0, fallbackWeight));
              console.log(`🔍 DEBUG - ⚠️ FALLBACK weights for ${log.exercise}:`, newLog.weights);
            }

            // ✅ ENHANCED: ALWAYS prefill reps using best set performance + progression
            if (!isDeloadWeek) {
              console.log(`🔍 DEBUG - Processing rep progression for ${log.exercise}...`);
              const { bestReps, averageRpe } = getBestSetMetrics(recentExercise.actual_reps, recentExercise.rpe);
              const repIncrease = averageRpe <= 8 ? 1 : 0; // Only increase if average RPE was 8 or less
              newLog.plannedReps = Math.max(1, bestReps + repIncrease);
              console.log(`🔍 DEBUG - ✅ REP PROGRESSION: ${bestReps} + ${repIncrease} = ${newLog.plannedReps} (avgRPE: ${averageRpe.toFixed(1)})`);
            }

            // Initialize tracking arrays with target RPEs
            newLog.actualReps = Array(newLog.currentSets).fill(0);
            newLog.rpe = Array.from({ length: newLog.currentSets }, (_, i) => 
              getTargetRPE(actualWeek, i, newLog.currentSets)
            );
            
            console.log(`🔍 DEBUG - Initialized arrays for ${log.exercise}:`, {
              actualReps: newLog.actualReps,
              rpe: newLog.rpe
            });
            
          } else {
            console.log(`🔍 DEBUG - No previous data for ${log.exercise} - using template values`);
            
            // Handle deload for new exercises
            if (isDeloadWeek) {
              const deloadSets = Math.max(1, Math.round(newLog.currentSets * (1/3)));
              const deloadReps = Math.max(1, Math.round(newLog.plannedReps * (1/3)));
              newLog.plannedSets = deloadSets;
              newLog.currentSets = deloadSets;
              newLog.plannedReps = deloadReps;
              console.log(`🔍 DEBUG - DELOAD (no prev): ${log.exercise} - Sets: ${log.currentSets} → ${deloadSets}, Reps: ${log.plannedReps} → ${deloadReps}`);
            }
            
            // For week 2+, still start with empty values for new exercises
            newLog.weights = Array(newLog.currentSets).fill(0);
            newLog.actualReps = Array(newLog.currentSets).fill(0);
            newLog.rpe = Array.from({ length: newLog.currentSets }, (_, i) => 
              getTargetRPE(actualWeek, i, newLog.currentSets)
            );
            console.log(`🔍 DEBUG - New exercise in week ${actualWeek}: starting with empty values`);
          }
          
          // ✅ NEW: Final validation to ensure data integrity
          newLog = ensureArrayIntegrity(newLog);
          
          console.log(`🔍 DEBUG - Final ${log.exercise}: ${newLog.currentSets} sets, ${newLog.plannedReps} reps`);
          updatedLogs.push(newLog);
          
        } catch (error) {
          console.error(`🔍 DEBUG - Error processing exercise ${log.exercise}:`, error);
          // Return log with safe defaults
          updatedLogs.push(ensureArrayIntegrity(log));
        }
      }

      // ✅ NEW: Apply muscle group-based set adjustments with enhanced error handling
      console.log('🔍 DEBUG - Applying muscle group set adjustments...');
      const isDeloadWeek = actualWeek === workoutData.duration_weeks;
      if (!isDeloadWeek && actualWeek >= 2) {
        for (const mg of muscleGroups) {
          try {
            const adjustment = muscleGroupAdjustments[mg];
            console.log(`🔍 DEBUG - Checking adjustment for ${mg}: ${adjustment}`);
            
            if (adjustment === 0) {
              console.log(`🔍 DEBUG - No adjustment needed for ${mg}`);
              continue;
            }

            const mgLogs = updatedLogs.filter(log => log?.muscleGroup === mg);
            console.log(`🔍 DEBUG - Found ${mgLogs.length} exercises for ${mg} adjustment`);
            
            if (mgLogs.length === 0) continue;

            if (adjustment > 0) {
              console.log(`🔍 DEBUG - Increasing sets for ${mg} by ${adjustment}`);
              
              // ✅ NEW: Check weekly limit before increasing
              const currentWeeklySets = weeklySetsByMuscleGroup[mg] || 0;
              const todayTotalSets = mgLogs.reduce((total, log) => total + (log?.currentSets || 0), 0);
              const projectedWeeklySets = currentWeeklySets + todayTotalSets + adjustment;

              console.log(`🔍 DEBUG - Weekly sets check for ${mg}:`, {
                current: currentWeeklySets,
                today: todayTotalSets,
                adjustment,
                projected: projectedWeeklySets
              });

              if (projectedWeeklySets > 21) {
                console.log(`🔍 DEBUG - ${mg}: Cannot increase sets. Weekly limit reached (${currentWeeklySets} + ${todayTotalSets} + ${adjustment} = ${projectedWeeklySets} > 21)`);
                toast({
                  title: "Weekly Set Limit Reached",
                  description: `${mg} has already reached 21 sets this week. Cannot auto-increase further.`,
                  variant: "default"
                });
                continue;
              }

              // Find exercise with minimum sets to increase
              const targetExercise = findExerciseForSetAdjustment(mgLogs, mg, true);
              if (targetExercise) {
                const oldSets = targetExercise.currentSets;
                targetExercise.currentSets += adjustment;
                targetExercise.plannedSets = targetExercise.currentSets;
                
                console.log(`🔍 DEBUG - Increasing ${targetExercise.exercise} from ${oldSets} to ${targetExercise.currentSets} sets`);
                
                // Resize arrays safely
                while (targetExercise.actualReps.length < targetExercise.currentSets) {
                  targetExercise.actualReps.push(0);
                  const lastWeight = targetExercise.weights[targetExercise.weights.length - 1];
                  targetExercise.weights.push(Number(lastWeight) || 0);
                  const newSetIndex = targetExercise.rpe.length;
                  targetExercise.rpe.push(getTargetRPE(actualWeek, newSetIndex, targetExercise.currentSets));
                }
                
                // Ensure integrity
                ensureArrayIntegrity(targetExercise);
                
                console.log(`🔍 DEBUG - INCREASED: ${targetExercise.exercise} by ${adjustment} sets (${oldSets} → ${targetExercise.currentSets} sets)`);
              }
            } else {
              console.log(`🔍 DEBUG - Decreasing sets for ${mg} by ${Math.abs(adjustment)}`);
              
              // Find exercise with maximum sets to decrease
              const targetExercise = findExerciseForSetAdjustment(mgLogs, mg, false);
              if (targetExercise) {
                const oldSets = targetExercise.currentSets;
                const newSets = Math.max(1, targetExercise.currentSets + adjustment); // Min 1 set
                const actualDecrease = targetExercise.currentSets - newSets;
                
                console.log(`🔍 DEBUG - Decreasing ${targetExercise.exercise} from ${oldSets} to ${newSets} sets`);
                
                targetExercise.currentSets = newSets;
                targetExercise.plannedSets = newSets;
                
                // Resize arrays safely
                targetExercise.actualReps = targetExercise.actualReps.slice(0, newSets);
                targetExercise.weights = targetExercise.weights.slice(0, newSets);
                targetExercise.rpe = targetExercise.rpe.slice(0, newSets);
                
                // Ensure minimum array lengths
                ensureArrayIntegrity(targetExercise);
                
                console.log(`🔍 DEBUG - DECREASED: ${targetExercise.exercise} by ${actualDecrease} sets (${oldSets} → ${targetExercise.currentSets} sets)`);
              }
            }
          } catch (error) {
            console.error(`🔍 DEBUG - Error applying adjustment for muscle group ${mg}:`, error);
          }
        }
      } else {
        console.log(`🔍 DEBUG - Skipping set adjustments - isDeloadWeek: ${isDeloadWeek}, actualWeek: ${actualWeek}`);
      }

      console.log('🔍 DEBUG - Final initialized logs with same-exercise progression:', updatedLogs);
      console.log('🔍 DEBUG - Setting workoutLogs state...');
      setWorkoutLogs(updatedLogs);
      console.log('🔍 DEBUG - initializeWorkoutLogs completed successfully');
      
    } catch (e) {
      console.error('🔍 DEBUG - Prefill initialization failed:', e);
      console.error('🔍 DEBUG - Error stack:', e.stack);
      // Fallback to empty logs
      setWorkoutLogs([]);
    }
  };

  // ✅ ENHANCED: Comprehensive input validation and error handling
  const updateSetData = (exerciseIndex: number, setIndex: number, field: 'reps' | 'weight' | 'rpe', value: number) => {
    console.log(`🔍 DEBUG - updateSetData called:`, { exerciseIndex, setIndex, field, value });
    
    setWorkoutLogs(prevLogs => {
      try {
        const updatedLogs = [...prevLogs];
        const exercise = updatedLogs[exerciseIndex];
        
        if (!exercise || setIndex < 0 || setIndex >= exercise.currentSets) {
          console.warn(`🔍 DEBUG - Invalid indices: exercise=${exerciseIndex}, set=${setIndex}, currentSets=${exercise?.currentSets}`);
          return prevLogs;
        }
        
        // Validate and sanitize input
        const validatedValue = validateNumericInput(String(value), field);
        console.log(`🔍 DEBUG - Validated value: ${validatedValue}`);
        
        // Ensure arrays are properly sized
        exercise.actualReps = exercise.actualReps || [];
        exercise.weights = exercise.weights || [];
        exercise.rpe = exercise.rpe || [];
        
        while (exercise.actualReps.length < exercise.currentSets) {
          exercise.actualReps.push(0);
        }
        while (exercise.weights.length < exercise.currentSets) {
          exercise.weights.push(0);
        }
        while (exercise.rpe.length < exercise.currentSets) {
          exercise.rpe.push(getTargetRPE(currentWeek, exercise.rpe.length, exercise.currentSets));
        }
        
        // Update the specific field
        if (field === 'reps') exercise.actualReps[setIndex] = validatedValue;
        else if (field === 'weight') exercise.weights[setIndex] = validatedValue;
        else if (field === 'rpe') exercise.rpe[setIndex] = validatedValue;
        
        console.log(`🔍 DEBUG - Updated ${exercise.exercise} set ${setIndex + 1} ${field}: ${validatedValue}`);
        
        // Update completion status
        exercise.completed = isExerciseCompleted(exercise);
        console.log(`🔍 DEBUG - Exercise ${exercise.exercise} completed: ${exercise.completed}`);
        
        return updatedLogs;
        
      } catch (error) {
        console.error('🔍 DEBUG - Error updating set data:', error);
        return prevLogs;
      }
    });
  };

  // ✅ ENHANCED: Safe set management with validation
  const addSet = (exerciseIndex: number) => {
    console.log(`🔍 DEBUG - addSet called for exercise ${exerciseIndex}`);
    
    setWorkoutLogs(prevLogs => {
      try {
        const updatedLogs = [...prevLogs];
        const exercise = updatedLogs[exerciseIndex];
        
        if (!exercise || exercise.currentSets >= 20) {
          console.warn(`🔍 DEBUG - Cannot add set: invalid exercise or too many sets (${exercise?.currentSets})`);
          return prevLogs;
        }
        
        exercise.currentSets++;
        exercise.actualReps.push(0);
        exercise.weights.push(exercise.weights[exercise.weights.length - 1] || 0);
        const newSetIndex = exercise.rpe.length;
        exercise.rpe.push(getTargetRPE(currentWeek, newSetIndex, exercise.currentSets));
        exercise.completed = false;
        
        console.log(`🔍 DEBUG - Added set to ${exercise.exercise}: now ${exercise.currentSets} sets`);
        
        return updatedLogs;
      } catch (error) {
        console.error('🔍 DEBUG - Error adding set:', error);
        return prevLogs;
      }
    });
  };

  // ✅ ENHANCED: Safe set removal with validation
  const removeSet = (exerciseIndex: number) => {
    console.log(`🔍 DEBUG - removeSet called for exercise ${exerciseIndex}`);
    
    setWorkoutLogs(prevLogs => {
      try {
        const updatedLogs = [...prevLogs];
        const exercise = updatedLogs[exerciseIndex];
        
        if (!exercise || exercise.currentSets <= 1) {
          console.warn(`🔍 DEBUG - Cannot remove set: invalid exercise or minimum sets reached (${exercise?.currentSets})`);
          return prevLogs;
        }
        
        exercise.currentSets--;
        exercise.actualReps.pop();
        exercise.weights.pop();
        exercise.rpe.pop();
        exercise.completed = false;
        
        console.log(`🔍 DEBUG - Removed set from ${exercise.exercise}: now ${exercise.currentSets} sets`);
        
        return updatedLogs;
      } catch (error) {
        console.error('🔍 DEBUG - Error removing set:', error);
        return prevLogs;
      }
    });
  };

  const isExerciseCompleted = (exercise: WorkoutLog) => {
    console.log(`🔍 DEBUG - Checking completion for ${exercise.exercise}`);
    
    try {
      if (!exercise) {
        console.log('🔍 DEBUG - No exercise provided');
        return false;
      }
      
      for (let i = 0; i < exercise.currentSets; i++) {
        const reps = exercise.actualReps?.[i];
        const weight = exercise.weights?.[i];
        
        console.log(`🔍 DEBUG - Set ${i + 1}: reps=${reps}, weight=${weight}`);
        
        if (!reps || reps === 0 || weight === null || weight === undefined) {
          console.log(`🔍 DEBUG - Set ${i + 1} incomplete: missing reps or weight`);
          return false;
        }
        
        // Week 1 requires RPE input, other weeks don't
        if (currentWeek === 1) {
          const rpe = exercise.rpe?.[i];
          if (!rpe || rpe < 1 || rpe > 10) {
            console.log(`🔍 DEBUG - Set ${i + 1} incomplete: missing or invalid RPE (${rpe})`);
            return false;
          }
        }
      }
      
      console.log(`🔍 DEBUG - ${exercise.exercise} is complete`);
      return true;
    } catch (error) {
      console.error('🔍 DEBUG - Error checking exercise completion:', error);
      return false;
    }
  };

  const getMuscleGroupExercises = (muscleGroup: string) => {
    console.log(`🔍 DEBUG - getMuscleGroupExercises called for: ${muscleGroup}`);
    
    try {
      const exercises = workoutLogs.filter(log => log?.muscleGroup === muscleGroup);
      console.log(`🔍 DEBUG - Found ${exercises.length} exercises for ${muscleGroup}:`, exercises.map(ex => ex.exercise));
      return exercises;
    } catch (error) {
      console.error('🔍 DEBUG - Error getting muscle group exercises:', error);
      return [];
    }
  };

  const getUniqueMuscleGroups = () => {
    console.log('🔍 DEBUG - getUniqueMuscleGroups called');
    
    try {
      const groups = Array.from(new Set(workoutLogs.map(log => log?.muscleGroup).filter(Boolean)));
      console.log('🔍 DEBUG - Unique muscle groups:', groups);
      return groups;
    } catch (error) {
      console.error('🔍 DEBUG - Error getting unique muscle groups:', error);
      return [];
    }
  };

  const handleMuscleGroupComplete = (muscleGroup: string) => {
    console.log(`🔍 DEBUG - handleMuscleGroupComplete called for: ${muscleGroup}`);
    
    try {
      const exercises = getMuscleGroupExercises(muscleGroup);
      console.log('Opening MPC feedback for:', muscleGroup, 'with', exercises.length, 'exercises');
      
      setFeedbackModal({
        isOpen: true,
        muscleGroup,
        exercises
      });
    } catch (error) {
      console.error('🔍 DEBUG - Error handling muscle group completion:', error);
      toast({
        title: "Error",
        description: "Failed to open feedback modal",
        variant: "destructive"
      });
    }
  };

  const saveMuscleGroupFeedback = async () => {
    console.log('🔍 DEBUG - saveMuscleGroupFeedback called');
    
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
      
      // Save pump feedback with error handling
      try {
        console.log('🔍 DEBUG - Saving pump feedback to database...');
        const pumpResult = await supabase.from('pump_feedback').insert({
          user_id: user.id,
          workout_date: new Date().toISOString().split('T')[0],
          muscle_group: muscleGroup,
          pump_level: feedback.pumpLevel
        });
        console.log('🔍 DEBUG - Pump feedback save result:', pumpResult);
      } catch (error) {
        console.error('Failed to save pump feedback:', error);
      }
      
      // Save all exercises in this muscle group to mesocycle
      console.log('🔍 DEBUG - Saving exercises to mesocycle table...');
      for (const exercise of exercises) {
        try {
          const exerciseData = {
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
            rir: exercise.rpe.reduce((sum, rpe) => sum + (Number(rpe) || 0), 0) / exercise.rpe.length,
            pump_level: feedback.pumpLevel,
            is_sore: false,
            can_add_sets: false,
            feedback_given: true
          };
          
          console.log(`🔍 DEBUG - Saving ${exercise.exercise} to mesocycle:`, exerciseData);
          
          const mesocycleResult = await supabase.from('mesocycle').insert(exerciseData);
          console.log(`🔍 DEBUG - Mesocycle save result for ${exercise.exercise}:`, mesocycleResult);
        } catch (error) {
          console.error(`Failed to save exercise ${exercise.exercise}:`, error);
        }
      }

      setFeedbackModal({ isOpen: false, muscleGroup: '', exercises: [] });
      
      // Check if all muscle groups are completed
      const allMuscleGroups = getUniqueMuscleGroups();
      const updatedCompletedGroups = new Set(completedMuscleGroups).add(muscleGroup);
      
      console.log('🔍 DEBUG - Completion check:', {
        allGroups: allMuscleGroups,
        completedCount: updatedCompletedGroups.size,
        allCount: allMuscleGroups.length
      });
      
      if (updatedCompletedGroups.size === allMuscleGroups.length) {
        console.log('🔍 DEBUG - All muscle groups completed, finishing workout day');
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
    console.log('🔍 DEBUG - completeWorkoutDay called');
    
    try {
      // Mark workout as completed
      console.log('🔍 DEBUG - Marking workout as completed in calendar...');
      const calendarResult = await supabase.from('workout_calendar').insert({
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
      console.log('🔍 DEBUG - Workout calendar save result:', calendarResult);

      // Progress to next day/week
      const structure = workout.workout_structure;
      const maxDays = Object.keys(structure).filter(dayKey => {
        const dayWorkout = structure[dayKey];
        return Array.isArray(dayWorkout) && dayWorkout.length > 0;
      }).length;
      
      const nextDay = currentDay < maxDays ? currentDay + 1 : 1;
      const nextWeek = currentDay < maxDays ? currentWeek : currentWeek + 1;
      
      console.log('🔍 DEBUG - Updating active workout:', { currentDay, currentWeek, nextDay, nextWeek, maxDays });
      
      const activeWorkoutResult = await supabase
        .from('active_workouts')
        .update({
          current_day: nextDay,
          current_week: nextWeek,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('workout_id', workoutId);
        
      console.log('🔍 DEBUG - Active workout update result:', activeWorkoutResult);

      // Check if mesocycle is complete
      if (nextWeek > workout.duration_weeks) {
        console.log('🔍 DEBUG - Mesocycle complete, saving to completed mesocycles...');
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
    console.log('🔍 DEBUG - saveCompletedMesocycle called');
    
    try {
      const { data: activeWorkout } = await supabase
        .from('active_workouts')
        .select('*')
        .eq('user_id', user.id)
        .eq('workout_id', workoutId)
        .maybeSingle();

      console.log('🔍 DEBUG - Active workout for completion:', activeWorkout);

      if (!activeWorkout) return;

      const { data: mesocycleData } = await supabase
        .from('mesocycle')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_id', workoutId);

      console.log('🔍 DEBUG - Mesocycle data for completion:', mesocycleData?.length, 'records');

      const completedResult = await supabase
        .from('completed_mesocycles')
        .insert({
          user_id: user.id,
          mesocycle_name: workout.name || 'Custom Workout',
          program_type: workout.program_type || 'Custom',
          start_date: new Date(activeWorkout.started_at).toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0],
          total_weeks: workout.duration_weeks,
          total_days: workout.days_per_week * workout.duration_weeks,
          mesocycle_data: {
            workouts: mesocycleData || [],
            workout_structure: workout.workout_structure
          }
        });

      console.log('🔍 DEBUG - Completed mesocycle save result:', completedResult);

      const deleteResult = await supabase
        .from('active_workouts')
        .delete()
        .eq('user_id', user.id)
        .eq('workout_id', workoutId);

      console.log('🔍 DEBUG - Active workout delete result:', deleteResult);
    } catch (error) {
      console.error('Error saving completed mesocycle:', error);
    }
  };

  console.log('🔍 DEBUG - Rendering component with loading:', loading, 'workout:', !!workout);

  if (loading) {
    console.log('🔍 DEBUG - Rendering loading state');
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
    console.log('🔍 DEBUG - Rendering no workout state');
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">Workout not found</div>
        </div>
      </div>
    );
  }

  console.log('🔍 DEBUG - Rendering main workout interface');
  console.log('🔍 DEBUG - Soreness modal state:', { isOpen: scModal.isOpen, muscleGroup: scModal.muscleGroup });

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
            
            console.log(`🔍 DEBUG - Muscle group ${muscleGroup}:`, { 
              exerciseCount: exercises.length, 
              isCompleted, 
              hasCompletedFeedback 
            });
            
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
                            {Array.from({ length: exercise.currentSets }).map((_, setIndex) => {
                              const targetRPE = getTargetRPE(currentWeek, setIndex, exercise.currentSets);
                              
                              return (
                                <div key={setIndex} className="border rounded p-2 sm:p-3 bg-card">
                                  <div className="flex items-center justify-between mb-2">
                                    <Label className="text-xs sm:text-sm font-medium">
                                      Set {setIndex + 1}
                                    </Label>
                                    {/* ✅ NEW: RPE Target Badge for Week 2+ */}
                                    {currentWeek > 1 && (
                                      <Badge variant="outline" className="text-xs">
                                        RPE {targetRPE}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="space-y-2">
                                    <div>
                                      <Label className="text-xs text-muted-foreground">
                                        Weight ({weightUnit})
                                      </Label>
                                      <Input
                                        type="number"
                                        value={exercise.weights?.[setIndex] || ''}
                                        placeholder={currentWeek === 1 ? "" : "Previous weight"}
                                        onChange={(e) => {
                                          const value = validateNumericInput(e.target.value, 'weight');
                                          updateSetData(originalIndex, setIndex, 'weight', value);
                                        }}
                                        className="h-8 text-sm"
                                        min="0"
                                        max="999"
                                        step="0.5"
                                        onKeyPress={(e) => {
                                          // Allow only numbers and decimal point
                                          if (!/[0-9.]/.test(e.key) && e.key !== 'Backspace') {
                                            e.preventDefault();
                                          }
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs text-muted-foreground">
                                        Reps
                                      </Label>
                                      <Input
                                        type="number"
                                        value={exercise.actualReps?.[setIndex] || ''}
                                        placeholder={currentWeek === 1 ? String(exercise.plannedReps || '') : "Target reps"}
                                        onChange={(e) => {
                                          const value = validateNumericInput(e.target.value, 'reps');
                                          updateSetData(originalIndex, setIndex, 'reps', value);
                                        }}
                                        className="h-8 text-sm"
                                        min="1"
                                        max="100"
                                        onKeyPress={(e) => {
                                          // Allow only numbers
                                          if (!/[0-9]/.test(e.key) && e.key !== 'Backspace') {
                                            e.preventDefault();
                                          }
                                        }}
                                      />
                                    </div>
                                    {/* ✅ NEW: Week 1 - Disabled RPE input showing 7, Week 2+ - No RPE input */}
                                    {currentWeek === 1 && (
                                      <div>
                                        <div className="flex items-center gap-1 mb-1">
                                          <Label className="text-xs text-muted-foreground">
                                            RPE <span className="text-destructive">*</span>
                                          </Label>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-4 w-4 p-0"
                                            onClick={() => setRpeInfoModal(true)}
                                          >
                                            <Info className="h-3 w-3" />
                                          </Button>
                                        </div>
                                        <Input
                                          type="number"
                                          value={7}
                                          disabled
                                          className="h-8 text-sm bg-muted"
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
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

        {/* ✅ NEW: RPE Information Modal */}
        <Dialog open={rpeInfoModal} onOpenChange={setRpeInfoModal}>
          <DialogContent className="max-w-sm sm:max-w-md mx-4">
            <DialogHeader>
              <DialogTitle className="text-lg">What is RPE?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <strong>RPE (Rate of Perceived Exertion)</strong> is a scale from 1-10 that measures how difficult a set feels:
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span>RPE 6:</span>
                  <span>4+ reps left in tank</span>
                </div>
                <div className="flex justify-between">
                  <span>RPE 7:</span>
                  <span>3 reps left in tank</span>
                </div>
                <div className="flex justify-between">
                  <span>RPE 8:</span>
                  <span>2 reps left in tank</span>
                </div>
                <div className="flex justify-between">
                  <span>RPE 9:</span>
                  <span>1 rep left in tank</span>
                </div>
                <div className="flex justify-between">
                  <span>RPE 10:</span>
                  <span>Maximum effort, no reps left</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Week 1 targets RPE 7 for all sets to establish baseline performance.
              </p>
            </div>
          </DialogContent>
        </Dialog>

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
        <Dialog open={scModal.isOpen} onOpenChange={() => {
          console.log('🔍 DEBUG - Soreness modal onOpenChange called (blocked)');
        }}>
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