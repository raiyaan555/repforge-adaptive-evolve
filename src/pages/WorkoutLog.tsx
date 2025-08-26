import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Plus, Minus, Info, AlertTriangle } from 'lucide-react';
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
  expectedReps: number[]; // ✅ Track expected reps for each set based on RPE progression
  actualReps: number[];
  weights: number[];
  prefilledWeights: number[]; // ✅ Track prefilled weights to detect manual changes
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

  // ✅ NEW: RPE Info Modal
  const [rpeInfoModal, setRpeInfoModal] = useState(false);

  // ✅ NEW: Weight Change Confirmation Modal (Week 2+ only)
  const [weightChangeModal, setWeightChangeModal] = useState<{
    isOpen: boolean;
    exerciseIndex: number;
    setIndex: number;
    originalWeight: number;
    newWeight: number;
    resolve: (keepOriginal: boolean) => void;
  }>({ isOpen: false, exerciseIndex: -1, setIndex: -1, originalWeight: 0, newWeight: 0, resolve: () => {} });

  // ✅ NEW: Function to get target RPE based on week and set position
  const getTargetRPE = (week: number, setIndex: number, totalSets: number) => {
    if (week === 1) return 7;
    if (week === 7) return 7; // Deload week
    
    const isLastSet = setIndex === totalSets - 1;
    
    if (week >= 2 && week <= 3) {
      return isLastSet ? 9 : 8;
    }
    if (week >= 4 && week <= 5) {
      return isLastSet ? 10 : 9;
    }
    if (week === 6) {
      return 10;
    }
    
    return 7; // fallback
  };

  // ✅ NEW: Input validation helpers
  const validateNumericInput = (value: string, field: 'reps' | 'weight' | 'rpe'): number => {
    // Remove non-numeric characters except decimal point
    const cleanValue = value.replace(/[^0-9.]/g, '');
    const numValue = parseFloat(cleanValue);
    
    if (isNaN(numValue) || numValue < 0) {
      switch (field) {
        case 'rpe': return 7; // Default RPE
        case 'reps': return 1; // Minimum reps
        case 'weight': return 0; // Can be 0 for bodyweight
      }
    }
    
    // Apply field-specific constraints
    switch (field) {
      case 'rpe': return Math.min(Math.max(Math.round(numValue), 1), 10);
      case 'reps': return Math.min(Math.max(Math.round(numValue), 1), 100);
      case 'weight': return Math.min(Math.max(numValue, 0), 999);
    }
    
    return numValue;
  };

  const ensureArrayIntegrity = (exercise: WorkoutLog): WorkoutLog => {
    const correctedExercise = { ...exercise };
    const targetLength = correctedExercise.currentSets;
    
    // Ensure all arrays match currentSets length
    correctedExercise.actualReps = Array.from({ length: targetLength }, (_, i) => 
      correctedExercise.actualReps[i] || 0
    );
    correctedExercise.weights = Array.from({ length: targetLength }, (_, i) => 
      correctedExercise.weights[i] || 0
    );
    correctedExercise.prefilledWeights = Array.from({ length: targetLength }, (_, i) => 
      correctedExercise.prefilledWeights[i] || 0
    );
    correctedExercise.rpe = Array.from({ length: targetLength }, (_, i) => 
      correctedExercise.rpe[i] || getTargetRPE(currentWeek, i, targetLength)
    );
    correctedExercise.expectedReps = Array.from({ length: targetLength }, (_, i) => 
      correctedExercise.expectedReps[i] || correctedExercise.plannedReps
    );
    
    return correctedExercise;
  };

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
    
    try {
      for (let i = 0; i < muscleGroups.length; i++) {
        const currentGroup = muscleGroups[i];
        console.log(`🔍 DEBUG - Processing soreness for: ${currentGroup} (${i + 1}/${muscleGroups.length})`);
        
        // ✅ FIX: Reset soreness value for each new muscle group
        setCurrentSorenessValue('');
        
        const result = await new Promise<string | null>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Soreness prompt timeout'));
          }, 60000); // 60 second timeout
          
          console.log(`🔍 DEBUG - Setting scModal state for ${currentGroup}`);
          setScModal({
            isOpen: true,
            muscleGroup: currentGroup,
            pendingGroups: muscleGroups.slice(i + 1),
            resolve: (value) => {
              clearTimeout(timeout);
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
    const weeklySetsByMuscleGroup: Record<string, number> = {};
    
    try {
      if (!user?.id || !workoutId || !Array.isArray(muscleGroups) || muscleGroups.length === 0) {
        console.log('🔍 DEBUG - Invalid parameters for weekly sets lookup');
        muscleGroups.forEach(mg => weeklySetsByMuscleGroup[mg] = 0);
        return weeklySetsByMuscleGroup;
      }

      const { data: weeklyData, error } = await supabase
        .from('mesocycle')
        .select('muscle_group, actual_sets')
        .eq('user_id', user.id)
        .eq('plan_id', workoutId)
        .eq('week_number', actualWeek)
        .in('muscle_group', muscleGroups);
        
      if (error) throw error;
      
      // Calculate total weekly sets per muscle group
      for (const mg of muscleGroups) {
        const mgData = weeklyData?.filter(d => d.muscle_group === mg) || [];
        weeklySetsByMuscleGroup[mg] = mgData.reduce((total, d) => {
          const sets = Number(d.actual_sets) || 0;
          return total + sets;
        }, 0);
        console.log(`🔍 DEBUG - Weekly sets for ${mg}: ${weeklySetsByMuscleGroup[mg]}`);
      }
    } catch (error) {
      console.error('🔍 DEBUG - Failed to load weekly sets data:', error);
      // Default to 0 if we can't load data
      for (const mg of muscleGroups) {
        weeklySetsByMuscleGroup[mg] = 0;
      }
    }
    
    return weeklySetsByMuscleGroup;
  };

  // ✅ NEW: Function to find exercise with min/max sets in a muscle group
  const findExerciseForSetAdjustment = (logs: WorkoutLog[], muscleGroup: string, isIncrease: boolean) => {
    try {
      const mgExercises = logs.filter(log => log?.muscleGroup === muscleGroup);
      if (mgExercises.length === 0) return null;
      
      if (isIncrease) {
        // Find exercise with minimum sets
        return mgExercises.reduce((min, current) => 
          (current?.currentSets || 0) < (min?.currentSets || 0) ? current : min
        );
      } else {
        // Find exercise with maximum sets
        return mgExercises.reduce((max, current) => 
          (current?.currentSets || 0) > (max?.currentSets || 0) ? current : max
        );
      }
    } catch (error) {
      console.error('🔍 DEBUG - Error finding exercise for set adjustment:', error);
      return null;
    }
  };

  // ✅ UPDATED: Enhanced to prioritize same exercise on same day for better duplication handling
  const getMostRecentExerciseData = async (exerciseName: string, muscleGroup: string, actualWeek: number, actualDay: number) => {
    try {
      console.log(`🔍 DEBUG - Looking for most recent data for ${exerciseName} (${muscleGroup}) on Day ${actualDay}`);
      
      // ✅ PRIORITY 1: Look for same exercise on same day in previous weeks (handles exercise duplication properly)
      const { data: sameDayData, error: sameDayError } = await supabase
        .from('mesocycle')
        .select('exercise_name, muscle_group, actual_sets, actual_reps, weight_used, rpe, pump_level, week_number, day_number, planned_reps')
        .eq('user_id', user.id)
        .eq('plan_id', workoutId)
        .eq('exercise_name', exerciseName)
        .eq('muscle_group', muscleGroup)
        .eq('day_number', actualDay) // ✅ Same day constraint for proper duplication handling
        .lt('week_number', actualWeek)
        .order('week_number', { ascending: false })
        .limit(1);
      
      if (!sameDayError && sameDayData && sameDayData.length > 0) {
        console.log(`🔍 DEBUG - ✅ Found same exercise on same day from Week ${sameDayData[0].week_number}:`, sameDayData[0]);
        return sameDayData[0];
      }
      
      // ✅ FALLBACK: If no same-day data found, look for any previous occurrence
      console.log(`🔍 DEBUG - No same-day data found, trying any previous occurrence...`);
      const { data: anyPreviousData, error: anyError } = await supabase
        .from('mesocycle')
        .select('exercise_name, muscle_group, actual_sets, actual_reps, weight_used, rpe, pump_level, week_number, day_number, planned_reps')
        .eq('user_id', user.id)
        .eq('plan_id', workoutId)
        .eq('exercise_name', exerciseName)
        .eq('muscle_group', muscleGroup)
        .or(`week_number.lt.${actualWeek},and(week_number.eq.${actualWeek},day_number.lt.${actualDay})`)
        .order('week_number', { ascending: false })
        .order('day_number', { ascending: false })
        .limit(1);
        
      if (anyError) {
        console.error('🔍 DEBUG - Query error details:', anyError);
        throw anyError;
      }
      
      const mostRecent = anyPreviousData?.[0];
      console.log(`🔍 DEBUG - Most recent data for ${exerciseName}:`, mostRecent ? '✅ Found (fallback)' : '❌ Not found');
      
      return mostRecent || null;
    } catch (error) {
      console.error(`🔍 DEBUG - Failed to get recent data for ${exerciseName}:`, error);
      return null;
    }
  };

  // ✅ NEW: Function to get best performing set metrics
  const getBestSetMetrics = (actualReps: any[], rpe: any[]) => {
    try {
      if (!Array.isArray(actualReps) || !Array.isArray(rpe) || actualReps.length === 0) {
        return { bestReps: 0, averageRpe: 7 };
      }

      // Convert to numbers and filter valid data
      const validSets = [];
      for (let i = 0; i < Math.min(actualReps.length, rpe.length); i++) {
        const reps = Number(actualReps[i]) || 0;
        const rpeVal = Number(rpe[i]) || 7;
        if (reps > 0) {
          validSets.push({ reps, rpe: rpeVal });
        }
      }

      if (validSets.length === 0) {
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

      console.log(`🔍 DEBUG - Best set metrics: reps=${bestSet.reps}, avgRPE=${averageRpe.toFixed(1)}`);
      return { bestReps: bestSet.reps, averageRpe };
    } catch (error) {
      console.error('🔍 DEBUG - Error calculating best set metrics:', error);
      return { bestReps: 0, averageRpe: 7 };
    }
  };

  // ✅ UPDATED: Proper RPE-based progression calculation as specified
  const calculateRepsFromRPEProgression = (previousReps: number, previousRPE: number, currentRPE: number): number => {
    console.log(`🔍 DEBUG - RPE Progression: ${previousReps} reps @ RPE ${previousRPE} → RPE ${currentRPE}`);
    
    // ✅ CORE LOGIC: Current reps = Previous reps + (Current RPE - Previous RPE)
    const rpeDifference = currentRPE - previousRPE;
    const newReps = previousReps + rpeDifference;
    
    // ✅ Ensure minimum 1 rep
    const finalReps = Math.max(1, newReps);
    
    console.log(`🔍 DEBUG - Final calculation: ${previousReps} + (${currentRPE} - ${previousRPE}) = ${finalReps}`);
    return finalReps;
  };

  // ✅ NEW: Function to find best set in current exercise for new set calculation
  const findBestSetInExercise = (exercise: WorkoutLog): { reps: number; rpe: number } => {
    try {
      const validSets = [];
      
      // Look at expected reps (which come from previous week's actual performance)
      for (let i = 0; i < exercise.expectedReps.length; i++) {
        const reps = exercise.expectedReps[i] || 0;
        const rpe = exercise.rpe[i] || 7;
        if (reps > 0) {
          validSets.push({ reps, rpe });
        }
      }
      
      if (validSets.length === 0) {
        return { reps: exercise.plannedReps, rpe: 7 };
      }
      
      // Find best set (highest reps, or if tied, lowest RPE)
      const bestSet = validSets.reduce((best, current) => {
        if (current.reps > best.reps) return current;
        if (current.reps === best.reps && current.rpe < best.rpe) return current;
        return best;
      });
      
      console.log(`🔍 DEBUG - Best set in ${exercise.exercise}: ${bestSet.reps} reps @ RPE ${bestSet.rpe}`);
      return bestSet;
    } catch (error) {
      console.error('🔍 DEBUG - Error finding best set:', error);
      return { reps: exercise.plannedReps, rpe: 7 };
    }
  };

  // ✅ NEW: Function to calculate expected reps for a new set
  const calculateNewSetExpectedReps = (exercise: WorkoutLog, newSetRPE: number): number => {
    try {
      const bestSet = findBestSetInExercise(exercise);
      const expectedReps = calculateRepsFromRPEProgression(bestSet.reps, bestSet.rpe, newSetRPE);
      
      console.log(`🔍 DEBUG - New set calculation: Best set ${bestSet.reps}@RPE${bestSet.rpe} → ${expectedReps}@RPE${newSetRPE}`);
      return expectedReps;
    } catch (error) {
      console.error('🔍 DEBUG - Error calculating new set expected reps:', error);
      return exercise.plannedReps;
    }
  };

  // ✅ COMPLETELY REWRITTEN: Enhanced function with proper same-exercise progression and Week 1 Day 2+ soreness
  const initializeWorkoutLogs = async (workoutData: any, actualWeek: number, actualDay: number) => {
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
          
          baseLogs.push({
            exercise: ex.name,
            muscleGroup: mg.muscleGroup,
            plannedSets: defaultSets,
            plannedReps: defaultReps,
            expectedReps: Array(defaultSets).fill(defaultReps),
            actualReps: Array(defaultSets).fill(0),
            weights: Array(defaultSets).fill(0),
            prefilledWeights: Array(defaultSets).fill(0),
            rpe: Array(defaultSets).fill(getTargetRPE(actualWeek, 0, defaultSets)),
            completed: false,
            currentSets: defaultSets,
          });
          console.log(`🔍 DEBUG - Added exercise: ${ex.name} to ${mg.muscleGroup}`);
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
      
      // ✅ FIXED: Start soreness checking from Week 1 Day 2+
      const scGroupsToAsk: string[] = [];
      
      for (const mg of muscleGroups) {
        let shouldAsk = false;
        
        if (actualWeek === 1 && actualDay >= 2) {
          // Week 1, Day 2+ → check if muscle group was trained in previous days of same week
          console.log(`🔍 DEBUG - Week 1, Day ${actualDay}: Checking previous days for ${mg}`);
          try {
            const { data: sameWeekPrevDays } = await supabase
              .from('mesocycle')
              .select('id, day_number')
              .eq('user_id', user.id)
              .eq('plan_id', workoutId)
              .eq('week_number', actualWeek)
              .eq('muscle_group', mg)
              .lt('day_number', actualDay);
            
            console.log(`🔍 DEBUG - Found ${(sameWeekPrevDays || []).length} previous same-week sessions for ${mg}:`, sameWeekPrevDays);
            shouldAsk = (sameWeekPrevDays || []).length > 0;
          } catch (error) {
            console.error('🔍 DEBUG - Error checking same week previous days:', error);
            shouldAsk = false;
          }
        } else if (actualWeek >= 2) {
          // Week 2+ → check if muscle group was trained in any previous days
          console.log(`🔍 DEBUG - Week ${actualWeek}: Checking any previous training for ${mg}`);
          try {
            const { data: anyPrevious } = await supabase
              .from('mesocycle')
              .select('id, week_number, day_number')
              .eq('user_id', user.id)
              .eq('plan_id', workoutId)
              .eq('muscle_group', mg)
              .or(`week_number.lt.${actualWeek},and(week_number.eq.${actualWeek},day_number.lt.${actualDay})`);
            
            console.log(`🔍 DEBUG - Found ${(anyPrevious || []).length} previous sessions for ${mg}:`, anyPrevious);
            shouldAsk = (anyPrevious || []).length > 0;
          } catch (error) {
            console.error('🔍 DEBUG - Error checking previous sessions:', error);
            shouldAsk = false;
          }
        }
        
        if (shouldAsk) {
          scGroupsToAsk.push(mg);
          console.log(`🔍 DEBUG - ✅ ADDED ${mg} to soreness check list`);
        } else {
          console.log(`🔍 DEBUG - ❌ SKIPPED ${mg} - shouldAsk = false`);
        }
        
        console.log(`🔍 DEBUG - ${mg}: shouldAsk=${shouldAsk} (week=${actualWeek}, day=${actualDay})`);
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
      for (const [mg, sc] of Object.entries(scResults)) {
        try {
          console.log(`🔍 DEBUG - Saving soreness result: ${mg} = ${sc}`);
          await supabase.from('muscle_soreness').insert({
            user_id: user.id,
            workout_date: new Date().toISOString().split('T')[0],
            muscle_group: mg,
            soreness_level: sc,
            healed: sc === 'none'
          });
        } catch (error) {
          console.error(`🔍 DEBUG - Failed to save soreness for ${mg}:`, error);
        }
      }

      // ✅ NEW: Get weekly sets count per muscle group
      const weeklySetsByMuscleGroup = await getWeeklySetsByMuscleGroup(muscleGroups, actualWeek);

      // ✅ NEW: Get previous pump levels for muscle groups (for MPC calculation)
      const pumpByGroup: Record<string, 'none'|'medium'|'amazing'> = {};
      if (actualWeek >= 2) {
        try {
          const { data: pumpData, error } = await supabase
            .from('pump_feedback')
            .select('muscle_group, pump_level')
            .eq('user_id', user.id)
            .order('workout_date', { ascending: false })
            .limit(50);
            
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
              }
            }
          }
        } catch (error) {
          console.error('🔍 DEBUG - Failed to load pump data:', error);
          for (const mg of muscleGroups) {
            pumpByGroup[mg] = 'medium';
          }
        }
      }

      // ✅ FIXED: Sets adjustment function
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

      // ✅ NEW: Calculate set adjustments per muscle group first
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
        }
      }

      // ✅ COMPLETELY REWRITTEN: Apply progression logic with proper RPE-based rep calculation
      const updatedLogs = [];
      for (const log of baseLogs) {
        try {
          let newLog = { ...log };
          
          console.log(`🔍 DEBUG - Processing ${log.exercise} (${log.muscleGroup})`);
          
          // ✅ FIX: Week 1 should have NO prefills - start completely empty
          if (actualWeek === 1) {
            console.log(`🔍 DEBUG - Week 1: ${log.exercise} - No prefills, starting empty`);
            newLog.weights = Array(newLog.currentSets).fill(0);
            newLog.prefilledWeights = Array(newLog.currentSets).fill(0);
            newLog.actualReps = Array(newLog.currentSets).fill(0);
            newLog.expectedReps = Array(newLog.currentSets).fill(newLog.plannedReps);
            newLog.rpe = Array(newLog.currentSets).fill(7);
            updatedLogs.push(ensureArrayIntegrity(newLog));
            continue;
          }

          // ✅ ENHANCED: Get most recent occurrence of this EXACT exercise (prioritizes same day for duplication handling)
          const recentExercise = await getMostRecentExerciseData(log.exercise, log.muscleGroup, actualWeek, actualDay);
          console.log(`🔍 DEBUG - Recent data for ${log.exercise}:`, recentExercise ? '✅ Found' : '❌ Not found');
          
          // ✅ FIXED: Deload logic (final week - reduce to 1/3 except if 1)
          const isDeloadWeek = actualWeek === workoutData.duration_weeks;
          console.log(`🔍 DEBUG - Is deload week: ${isDeloadWeek} (week ${actualWeek}/${workoutData.duration_weeks})`);
          
          if (recentExercise) {
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
            const prevWeights = recentExercise.weight_used;
            if (Array.isArray(prevWeights) && prevWeights.length > 0) {
              // Use actual weights from previous performance
              newLog.weights = Array.from({ length: newLog.currentSets }, (_, i) => {
                const weight = Number(prevWeights[i] || prevWeights[0] || 0);
                return Math.max(0, weight);
              });
              newLog.prefilledWeights = [...newLog.weights]; // ✅ Store prefilled weights
              console.log(`🔍 DEBUG - ✅ PREFILLED weights for ${log.exercise}:`, newLog.weights);
            } else {
              // Fallback: try to extract from other formats or use defaults
              const fallbackWeight = Number(prevWeights) || 0;
              newLog.weights = Array(newLog.currentSets).fill(Math.max(0, fallbackWeight));
              newLog.prefilledWeights = [...newLog.weights]; // ✅ Store prefilled weights
              console.log(`🔍 DEBUG - ⚠️ FALLBACK weights for ${log.exercise}:`, newLog.weights);
            }

            // ✅ CORE FEATURE: RPE-based rep progression calculation
            if (!isDeloadWeek) {
              const currentWeekRPEs = Array.from({ length: newLog.currentSets }, (_, i) => 
                getTargetRPE(actualWeek, i, newLog.currentSets)
              );
              const prevWeekRPEs = recentExercise.rpe || [];
              const prevActualReps = recentExercise.actual_reps || [];
              
              newLog.plannedReps = newLog.plannedReps; // Keep template default
              newLog.expectedReps = Array.from({ length: newLog.currentSets }, (_, i) => {
                const currentRPE = currentWeekRPEs[i];
                const prevRPE = Number(prevWeekRPEs[i]) || 7;
                const prevActual = Number(prevActualReps[i]) || newLog.plannedReps;
                
                // ✅ APPLY RPE PROGRESSION RULES: current reps = prev reps + (current RPE - prev RPE)
                const expectedReps = calculateRepsFromRPEProgression(prevActual, prevRPE, currentRPE);
                
                console.log(`🔍 DEBUG - Set ${i + 1}: ${prevActual} reps @ RPE ${prevRPE} → ${expectedReps} reps @ RPE ${currentRPE}`);
                return expectedReps;
              });
              
              console.log(`🔍 DEBUG - ✅ RPE-BASED REP PROGRESSION for ${log.exercise}:`, newLog.expectedReps);
            }

            // Initialize tracking arrays with target RPEs
            newLog.actualReps = Array(newLog.currentSets).fill(0);
            newLog.rpe = Array.from({ length: newLog.currentSets }, (_, i) => 
              getTargetRPE(actualWeek, i, newLog.currentSets)
            );
            
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
            newLog.prefilledWeights = Array(newLog.currentSets).fill(0);
            newLog.actualReps = Array(newLog.currentSets).fill(0);
            newLog.expectedReps = Array(newLog.currentSets).fill(newLog.plannedReps);
            newLog.rpe = Array.from({ length: newLog.currentSets }, (_, i) => 
              getTargetRPE(actualWeek, i, newLog.currentSets)
            );
            console.log(`🔍 DEBUG - New exercise in week ${actualWeek}: starting with empty values`);
          }
          
          // ✅ NEW: Final validation to ensure data integrity
          newLog = ensureArrayIntegrity(newLog);
          
          console.log(`🔍 DEBUG - Final ${log.exercise}: ${newLog.currentSets} sets, expected reps:`, newLog.expectedReps);
          updatedLogs.push(newLog);
        } catch (error) {
          console.error(`🔍 DEBUG - Error processing exercise ${log.exercise}:`, error);
          // Return log with safe defaults
          updatedLogs.push(ensureArrayIntegrity(log));
        }
      }

      // ✅ FIXED: Apply muscle group-based set adjustments with PROPER RPE-based expected reps for new sets
      const isDeloadWeek = actualWeek === workoutData.duration_weeks;
      if (!isDeloadWeek && actualWeek >= 2) {
        for (const mg of muscleGroups) {
          try {
            const adjustment = muscleGroupAdjustments[mg];
            if (adjustment === 0) continue;

            const mgLogs = updatedLogs.filter(log => log?.muscleGroup === mg);
            if (mgLogs.length === 0) continue;

            if (adjustment > 0) {
              // ✅ NEW: Check weekly limit before increasing
              const currentWeeklySets = weeklySetsByMuscleGroup[mg] || 0;
              const todayTotalSets = mgLogs.reduce((total, log) => total + (log?.currentSets || 0), 0);
              const projectedWeeklySets = currentWeeklySets + todayTotalSets + adjustment;

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
                
                // ✅ FIXED: Resize arrays safely with PROPER RPE-based expected reps for new sets
                while (targetExercise.actualReps.length < targetExercise.currentSets) {
                  targetExercise.actualReps.push(0);
                  const lastWeight = targetExercise.weights[targetExercise.weights.length - 1];
                  targetExercise.weights.push(Number(lastWeight) || 0);
                  targetExercise.prefilledWeights.push(Number(lastWeight) || 0);
                  
                  const newSetIndex = targetExercise.rpe.length;
                  const newSetRPE = getTargetRPE(actualWeek, newSetIndex, targetExercise.currentSets);
                  targetExercise.rpe.push(newSetRPE);
                  
                  // ✅ CRITICAL FIX: Calculate expected reps based on best existing set + RPE progression
                  const newSetExpectedReps = calculateNewSetExpectedReps(targetExercise, newSetRPE);
                  targetExercise.expectedReps.push(newSetExpectedReps);
                  
                  console.log(`🔍 DEBUG - New set ${newSetIndex + 1}: Expected ${newSetExpectedReps} reps @ RPE ${newSetRPE}`);
                }
                
                // Ensure integrity
                ensureArrayIntegrity(targetExercise);
                
                console.log(`🔍 DEBUG - INCREASED: ${targetExercise.exercise} by ${adjustment} sets (${oldSets} → ${targetExercise.currentSets} sets)`);
              }
            } else {
              // Find exercise with maximum sets to decrease
              const targetExercise = findExerciseForSetAdjustment(mgLogs, mg, false);
              if (targetExercise) {
                const oldSets = targetExercise.currentSets;
                const newSets = Math.max(1, targetExercise.currentSets + adjustment); // Min 1 set
                const actualDecrease = targetExercise.currentSets - newSets;
                
                targetExercise.currentSets = newSets;
                targetExercise.plannedSets = newSets;
                
                // Resize arrays safely
                targetExercise.actualReps = targetExercise.actualReps.slice(0, newSets);
                targetExercise.weights = targetExercise.weights.slice(0, newSets);
                targetExercise.prefilledWeights = targetExercise.prefilledWeights.slice(0, newSets);
                targetExercise.rpe = targetExercise.rpe.slice(0, newSets);
                targetExercise.expectedReps = targetExercise.expectedReps.slice(0, newSets);
                
                // Ensure minimum array lengths
                ensureArrayIntegrity(targetExercise);
                
                console.log(`🔍 DEBUG - DECREASED: ${targetExercise.exercise} by ${actualDecrease} sets (${oldSets} → ${targetExercise.currentSets} sets)`);
              }
            }
          } catch (error) {
            console.error(`🔍 DEBUG - Error applying adjustment for muscle group ${mg}:`, error);
          }
        }
      }

      console.log('🔍 DEBUG - Final initialized logs with RPE-based progression:', updatedLogs);
      setWorkoutLogs(updatedLogs);
      
    } catch (e) {
      console.error('🔍 DEBUG - Prefill initialization failed:', e);
      // Fallback to empty logs
      setWorkoutLogs([]);
    }
  };

  // ✅ NEW: Function to handle weight change confirmation (Week 2+ only)
  const handleWeightChange = async (exerciseIndex: number, setIndex: number, newWeight: number) => {
    const exercise = workoutLogs[exerciseIndex];
    const originalWeight = exercise?.prefilledWeights?.[setIndex] || 0;
    
    // ✅ NEW: Only show dialog for Week 2+ and when there's a significant change from prefilled weight
    if (currentWeek >= 2 && originalWeight > 0 && Math.abs(newWeight - originalWeight) > 0.1) {
      return new Promise<void>((resolve) => {
        setWeightChangeModal({
          isOpen: true,
          exerciseIndex,
          setIndex,
          originalWeight,
          newWeight,
          resolve: (keepOriginal) => {
            if (keepOriginal) {
              updateSetData(exerciseIndex, setIndex, 'weight', originalWeight);
            } else {
              updateSetData(exerciseIndex, setIndex, 'weight', newWeight);
            }
            setWeightChangeModal(prev => ({ ...prev, isOpen: false }));
            resolve();
          }
        });
      });
    } else {
      // Week 1 or no significant change - update normally
      updateSetData(exerciseIndex, setIndex, 'weight', newWeight);
    }
  };

  // ✅ ENHANCED: Comprehensive input validation and error handling
  const updateSetData = (exerciseIndex: number, setIndex: number, field: 'reps' | 'weight' | 'rpe', value: number) => {
    setWorkoutLogs(prevLogs => {
      try {
        const updatedLogs = [...prevLogs];
        const exercise = updatedLogs[exerciseIndex];
        
        if (!exercise || setIndex < 0 || setIndex >= exercise.currentSets) {
          console.warn(`🔍 DEBUG - Invalid indices: exercise=${exerciseIndex}, set=${setIndex}`);
          return prevLogs;
        }
        
        // Validate and sanitize input
        const validatedValue = validateNumericInput(String(value), field);
        
        // Ensure arrays are properly sized
        exercise.actualReps = exercise.actualReps || [];
        exercise.weights = exercise.weights || [];
        exercise.prefilledWeights = exercise.prefilledWeights || [];
        exercise.rpe = exercise.rpe || [];
        exercise.expectedReps = exercise.expectedReps || [];
        
        while (exercise.actualReps.length < exercise.currentSets) {
          exercise.actualReps.push(0);
        }
        while (exercise.weights.length < exercise.currentSets) {
          exercise.weights.push(0);
        }
        while (exercise.prefilledWeights.length < exercise.currentSets) {
          exercise.prefilledWeights.push(0);
        }
        while (exercise.rpe.length < exercise.currentSets) {
          exercise.rpe.push(getTargetRPE(currentWeek, exercise.rpe.length, exercise.currentSets));
        }
        while (exercise.expectedReps.length < exercise.currentSets) {
          exercise.expectedReps.push(exercise.plannedReps);
        }
        
        // Update the specific field
        if (field === 'reps') exercise.actualReps[setIndex] = validatedValue;
        else if (field === 'weight') exercise.weights[setIndex] = validatedValue;
        else if (field === 'rpe') exercise.rpe[setIndex] = validatedValue;
        
        // Update completion status
        exercise.completed = isExerciseCompleted(exercise);
        
        console.log(`🔍 DEBUG - Updated ${exercise.exercise} set ${setIndex + 1} ${field}: ${validatedValue}`);
        return updatedLogs;
        
      } catch (error) {
        console.error('🔍 DEBUG - Error updating set data:', error);
        return prevLogs;
      }
    });
  };

  // ✅ FIXED: Safe set management with validation and PROPER RPE-based expected reps for new sets
  const addSet = (exerciseIndex: number) => {
    setWorkoutLogs(prevLogs => {
      try {
        const updatedLogs = [...prevLogs];
        const exercise = updatedLogs[exerciseIndex];
        
        if (!exercise || exercise.currentSets >= 20) {
          console.warn(`🔍 DEBUG - Cannot add set: invalid exercise or too many sets`);
          return prevLogs;
        }
        
        exercise.currentSets++;
        exercise.actualReps.push(0);
        exercise.weights.push(exercise.weights[exercise.weights.length - 1] || 0);
        exercise.prefilledWeights.push(exercise.prefilledWeights[exercise.prefilledWeights.length - 1] || 0);
        
        // ✅ NEW SETS get proper RPE for current week and position
        const newSetIndex = exercise.rpe.length;
        const newSetRPE = getTargetRPE(currentWeek, newSetIndex, exercise.currentSets);
        exercise.rpe.push(newSetRPE);
        
        // ✅ CRITICAL FIX: Calculate expected reps based on best existing set + RPE progression
        const newSetExpectedReps = calculateNewSetExpectedReps(exercise, newSetRPE);
        exercise.expectedReps.push(newSetExpectedReps);
        
        exercise.completed = false;
        
        console.log(`🔍 DEBUG - Added set ${exercise.currentSets} with RPE ${newSetRPE} and expected ${newSetExpectedReps} reps to ${exercise.exercise}`);
        return updatedLogs;
      } catch (error) {
        console.error('🔍 DEBUG - Error adding set:', error);
        return prevLogs;
      }
    });
  };

  // ✅ ENHANCED: Safe set removal with validation
  const removeSet = (exerciseIndex: number) => {
    setWorkoutLogs(prevLogs => {
      try {
        const updatedLogs = [...prevLogs];
        const exercise = updatedLogs[exerciseIndex];
        
        if (!exercise || exercise.currentSets <= 1) {
          console.warn(`🔍 DEBUG - Cannot remove set: invalid exercise or minimum sets reached`);
          return prevLogs;
        }
        
        exercise.currentSets--;
        exercise.actualReps.pop();
        exercise.weights.pop();
        exercise.prefilledWeights.pop();
        exercise.rpe.pop();
        exercise.expectedReps.pop();
        exercise.completed = false;
        
        return updatedLogs;
      } catch (error) {
        console.error('🔍 DEBUG - Error removing set:', error);
        return prevLogs;
      }
    });
  };

  const isExerciseCompleted = (exercise: WorkoutLog) => {
    try {
      if (!exercise) return false;
      
      for (let i = 0; i < exercise.currentSets; i++) {
        const reps = exercise.actualReps?.[i];
        const weight = exercise.weights?.[i];
        
        if (!reps || reps === 0 || weight === null || weight === undefined) {
          return false;
        }
        
        // Week 1 requires RPE input, other weeks don't
        if (currentWeek === 1) {
          const rpe = exercise.rpe?.[i];
          if (!rpe || rpe < 1 || rpe > 10) {
            return false;
          }
        }
      }
      return true;
    } catch (error) {
      console.error('🔍 DEBUG - Error checking exercise completion:', error);
      return false;
    }
  };

  const getMuscleGroupExercises = (muscleGroup: string) => {
    try {
      return workoutLogs.filter(log => log?.muscleGroup === muscleGroup);
    } catch (error) {
      console.error('🔍 DEBUG - Error getting muscle group exercises:', error);
      return [];
    }
  };

  const getUniqueMuscleGroups = () => {
    try {
      return Array.from(new Set(workoutLogs.map(log => log?.muscleGroup).filter(Boolean)));
    } catch (error) {
      console.error('🔍 DEBUG - Error getting unique muscle groups:', error);
      return [];
    }
  };

  const handleMuscleGroupComplete = (muscleGroup: string) => {
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
        await supabase.from('pump_feedback').insert({
          user_id: user.id,
          workout_date: new Date().toISOString().split('T')[0],
          muscle_group: muscleGroup,
          pump_level: feedback.pumpLevel
        });
      } catch (error) {
        console.error('Failed to save pump feedback:', error);
      }
      
      // Save all exercises in this muscle group to mesocycle
      for (const exercise of exercises) {
        try {
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
            rir: exercise.rpe.reduce((sum, rpe) => sum + (Number(rpe) || 0), 0) / exercise.rpe.length,
            pump_level: feedback.pumpLevel,
            is_sore: false,
            can_add_sets: false,
            feedback_given: true
          });
        } catch (error) {
          console.error(`Failed to save exercise ${exercise.exercise}:`, error);
        }
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
          end_date: new Date().toISOString().split('T')[0],
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
                        
                          {/* ✅ UPDATED: Removed "Target Reps" text as requested */}
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
                              Sets: {exercise.currentSets}
                              {currentWeek === workout.duration_weeks && (
                                <Badge variant="outline" className="ml-2 text-xs">DELOAD</Badge>
                              )}
                            </span>
                          </div>
                        
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                            {Array.from({ length: exercise.currentSets }).map((_, setIndex) => {
                              const targetRPE = getTargetRPE(currentWeek, setIndex, exercise.currentSets);
                              const expectedReps = exercise.expectedReps?.[setIndex] || exercise.plannedReps;
                              
                              return (
                                <div key={setIndex} className="border rounded p-2 sm:p-3 bg-card">
                                  <div className="flex items-center justify-between mb-2">
                                    <Label className="text-xs sm:text-sm font-medium">
                                      Set {setIndex + 1}
                                    </Label>
                                    {/* ✅ RPE Target Badge for Week 2+ */}
                                    {currentWeek > 1 && (
                                      <Badge variant="outline" className="text-xs">
                                        RPE {targetRPE}
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  {/* ✅ Expected Reps Indicator for all weeks */}
                                  <div className="text-xs text-muted-foreground mb-2">
                                    Expected: {expectedReps} reps
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
                                        onChange={async (e) => {
                                          const value = validateNumericInput(e.target.value, 'weight');
                                          await handleWeightChange(originalIndex, setIndex, value);
                                        }}
                                        className="h-8 text-sm"
                                        min="0"
                                        max="999"
                                        step="0.5"
                                        onKeyDown={(e) => {
                                          // ✅ Prevent scroll behavior for weight input
                                          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                            e.preventDefault();
                                          }
                                        }}
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
                                      {/* ✅ UPDATED: Reps input now behaves like weight input (no scroll) */}
                                      <Input
                                        type="number"
                                        value={exercise.actualReps?.[setIndex] || ''}
                                        placeholder={String(expectedReps)}
                                        onChange={(e) => {
                                          const value = validateNumericInput(e.target.value, 'reps');
                                          updateSetData(originalIndex, setIndex, 'reps', value);
                                        }}
                                        className="h-8 text-sm"
                                        min="1"
                                        max="100"
                                        onKeyDown={(e) => {
                                          // ✅ NEW: Prevent scroll behavior for reps input (like weight input)
                                          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                            e.preventDefault();
                                          }
                                        }}
                                        onKeyPress={(e) => {
                                          // Allow only numbers
                                          if (!/[0-9]/.test(e.key) && e.key !== 'Backspace') {
                                            e.preventDefault();
                                          }
                                        }}
                                      />
                                    </div>
                                    {/* ✅ Week 1: Disabled RPE input showing 7, Week 2+: No RPE input */}
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

        {/* ✅ Weight Change Confirmation Modal (Week 2+ only) */}
        <Dialog open={weightChangeModal.isOpen} onOpenChange={() => {}}>
          <DialogContent className="max-w-sm sm:max-w-md mx-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Weight Change Detected
              </DialogTitle>
              <DialogDescription className="text-sm">
                For best results, keep the same weight as last time ({weightChangeModal.originalWeight} {weightUnit}).
                <br />
                <br />
                Change weight anyway?
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => weightChangeModal.resolve(true)}
                className="flex-1"
              >
                Keep Same Weight
              </Button>
              <Button
                onClick={() => weightChangeModal.resolve(false)}
                className="flex-1"
              >
                Change Weight
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ✅ RPE Information Modal */}
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

        {/* ✅ SC (Soreness) Modal with proper value reset */}
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