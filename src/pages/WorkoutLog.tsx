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

  // SC (Soreness) Modal - React-based, sequential
  const [scModal, setScModal] = useState<{
    isOpen: boolean;
    muscleGroup: string;
    pendingGroups: string[];
    resolve: (value: string | null) => void;
  }>({ isOpen: false, muscleGroup: '', pendingGroups: [], resolve: () => {} });

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
      
      try {
        // 1. Load workout data first
        const workoutData = await loadWorkout();
        if (!isMounted || !workoutData) return;
        
        // 2. Load active workout info (week/day)
        const activeInfo = await loadActiveWorkoutInfo();
        if (!isMounted) return;
        
        // 3. Initialize workout logs with proper sequencing
        await initializeWorkoutLogs(workoutData);
        
        // 4. Reset state for new workout
        if (isMounted) {
          setCompletedMuscleGroups(new Set());
          setMuscleGroupFeedbacks(new Map());
        }
      } catch (error) {
        console.error('Initialization failed:', error);
        if (isMounted) {
          toast({
            title: "Error",
            description: "Failed to initialize workout",
            variant: "destructive"
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          isInitializing = false;
        }
      }
    };
    
    initializeAll();
    
    return () => { 
      isMounted = false; 
      isInitializing = false;
    };
  }, [user, workoutId]);

  const loadWorkout = async () => {
    try {
      // Load workout from either default_workouts or custom_workouts
      let { data: defaultWorkout } = await supabase
        .from('default_workouts')
        .select('*')
        .eq('id', workoutId)
        .maybeSingle();

      if (!defaultWorkout) {
        const { data: customWorkout } = await supabase
          .from('custom_workouts')
          .select('*')
          .eq('id', workoutId)
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (customWorkout) {
          defaultWorkout = customWorkout;
        }
      }

      if (defaultWorkout) {
        setWorkout(defaultWorkout);
        return defaultWorkout;
      }
      return null;
    } catch (error) {
      console.error('Error loading workout:', error);
      return null;
    }
  };

  const loadActiveWorkoutInfo = async () => {
    try {
      const { data: activeWorkout } = await supabase
        .from('active_workouts')
        .select('current_week, current_day')
        .eq('user_id', user.id)
        .eq('workout_id', workoutId)
        .maybeSingle();
        
      if (activeWorkout) {
        console.log('Loading active workout info - Week:', activeWorkout.current_week, 'Day:', activeWorkout.current_day);
        setCurrentWeek(activeWorkout.current_week);
        setCurrentDay(activeWorkout.current_day);
        return activeWorkout;
      }
      return null;
    } catch (error) {
      console.error('Error loading active workout info:', error);
      return null;
    }
  };

  // ✅ FIXED: Simplified sequential SC prompting
  const promptForSoreness = useCallback(async (muscleGroups: string[]): Promise<Record<string, string>> => {
    const results: Record<string, string> = {};
    
    for (let i = 0; i < muscleGroups.length; i++) {
      const currentGroup = muscleGroups[i];
      console.log(`Asking soreness for: ${currentGroup} (${i + 1}/${muscleGroups.length})`);
      
      const result = await new Promise<string | null>((resolve) => {
        setScModal({
          isOpen: true,
          muscleGroup: currentGroup,
          pendingGroups: muscleGroups.slice(i + 1),
          resolve
        });
      });
      
      if (result) {
        results[currentGroup] = result;
      }
      
      // Close modal and add small delay for better UX
      setScModal(prev => ({ ...prev, isOpen: false }));
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }, []);

  const initializeWorkoutLogs = async (workoutData: any) => {
    const structure = workoutData.workout_structure as WorkoutStructure;
    console.log('Workout structure:', structure);
    
    const dayKey = `day${currentDay}`;
    const dayWorkout = structure[dayKey] || [];
    
    console.log('Day key:', dayKey, 'Day workout:', dayWorkout);
    
    // Create base logs from template
    const baseLogs: WorkoutLog[] = [];
    for (const mg of dayWorkout) {
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
      }
    }

    try {
      const muscleGroups = Array.from(new Set(baseLogs.map(l => l.muscleGroup)));
      console.log('Muscle groups for today:', muscleGroups);
      
      // ✅ FIXED: Sequential SC prompting for multiple muscle groups
      const scGroupsToAsk: string[] = [];
      
      for (const mg of muscleGroups) {
        let shouldAsk = currentWeek >= 2;
        
        if (!shouldAsk && currentWeek === 1) {
          // Check if this muscle group was trained earlier in the same week
          const { data: sameWeek } = await supabase
            .from('mesocycle')
            .select('id, day_number')
            .eq('user_id', user.id)
            .eq('plan_id', workoutId)
            .eq('week_number', currentWeek)
            .eq('muscle_group', mg)
            .lt('day_number', currentDay);
          shouldAsk = (sameWeek || []).length > 0;
        }
        
        if (shouldAsk) {
          scGroupsToAsk.push(mg);
        }
        
        console.log(`${mg}: shouldAsk=${shouldAsk} (week=${currentWeek})`);
      }

      // Ask for soreness sequentially if needed
      const scResults = await promptForSoreness(scGroupsToAsk);
      console.log('SC Results:', scResults);

      // Save SC results to database
      for (const [mg, sc] of Object.entries(scResults)) {
        await supabase.from('muscle_soreness').insert({
          user_id: user.id,
          workout_date: new Date().toISOString().split('T')[0],
          muscle_group: mg,
          soreness_level: sc,
          healed: sc === 'none'
        });
      }

      // Load previous week data with better error handling
      const prevWeek = currentWeek - 1;
      let prevRows: any[] = [];
      
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
          console.log(`Loaded ${prevRows.length} previous week records`);
        } catch (error) {
          console.error('Failed to load previous week data:', error);
          prevRows = [];
        }
      }

      // ✅ FIXED: Corrected mapPump function with proper comparison operators
      const mapPump = (p?: string) => {
        if (!p) return 'medium';
        if (p === 'negligible' || p === 'low' || p === 'none') return 'none';  // FIXED: === instead of =
        if (p === 'moderate' || p === 'medium') return 'medium';               // FIXED: === instead of =
        return 'amazing';
      };

      const pumpByGroup: Record<string, 'none'|'medium'|'amazing'> = {};
      for (const mg of muscleGroups) {
        // Get most recent pump level for this muscle group (across all exercises)
        const mgRows = prevRows.filter(r => r.muscle_group === mg && r.pump_level);
        if (mgRows.length > 0) {
          // Sort by day_number descending and take the first (most recent)
          const recent = mgRows.sort((a, b) => (b.day_number || 0) - (a.day_number || 0))[0];
          pumpByGroup[mg] = mapPump(recent.pump_level);
        } else {
          pumpByGroup[mg] = 'medium';
        }
        console.log(`${mg} pump level: ${pumpByGroup[mg]}`);
      }

      // ✅ FIXED: Sets adjustment function with proper comparison operators
      const setsAdjustment = (
        sc: 'none'|'medium'|'very_sore'|'extremely_sore'|undefined,
        pump: 'none'|'medium'|'amazing'
      ) => {
        if (!sc) return 0;
        if (sc === 'extremely_sore') return -1;                    // FIXED: === instead of =
        if (sc === 'none' && pump === 'none') return 3;           // FIXED: === instead of =
        if (sc === 'none' && pump === 'medium') return 2;         // FIXED: === instead of =
        if (sc === 'none' && pump === 'amazing') return 1;        // FIXED: === instead of =
        if (sc === 'medium' && pump === 'none') return 1;         // FIXED: === instead of =
        if (sc === 'medium' && pump === 'medium') return 1;       // FIXED: === instead of =
        if (sc === 'medium' && pump === 'amazing') return 1;      // FIXED: === instead of =
        if (sc === 'very_sore') return 0;                         // FIXED: === instead of =
        return 0;
      };

      // ✅ FIXED: Better exercise mapping for multiple exercises per muscle group
      const prevByExercise = new Map<string, any>();
      prevRows
        .sort((a,b) => (b.day_number||0) - (a.day_number||0))
        .forEach(r => { 
          if (!prevByExercise.has(r.exercise_name)) {
            prevByExercise.set(r.exercise_name, r); 
          }
        });

      // Apply progression logic to each exercise
      const updatedLogs = baseLogs.map(log => {
        const prev = prevByExercise.get(log.exercise);
        let newLog = { ...log };
        
        // ✅ FIXED: Deload logic (final week - reduce to 1/3 except if 1)
        const isDeloadWeek = currentWeek === workoutData.duration_weeks;
        
        if (prev) {
          let baseSets = prev.actual_sets || log.currentSets;
          
          if (isDeloadWeek) {
            // ✅ DELOAD: reduce to 1/3 of sets and reps, minimum 1
            const deloadSets = Math.max(1, Math.round(baseSets * (1/3)));
            newLog.plannedSets = deloadSets;
            newLog.currentSets = deloadSets;
            
            const prevReps = prev.actual_reps?.[0] || newLog.plannedReps;
            const deloadReps = Math.max(1, Math.round(prevReps * (1/3)));
            newLog.plannedReps = deloadReps;
            
            console.log(`DELOAD: ${log.exercise} - Sets: ${baseSets} → ${deloadSets}, Reps: ${prevReps} → ${deloadReps}`);
          } else if (currentWeek >= 2) {
            // Normal progression using SC + MPC
            const sc = scResults[log.muscleGroup] as any;
            const pump = pumpByGroup[log.muscleGroup] || 'medium';
            const setsAdd = setsAdjustment(sc, pump);
            const targetSets = Math.max(1, baseSets + setsAdd);
            
            newLog.plannedSets = targetSets;
            newLog.currentSets = targetSets;
            
            console.log(`${log.exercise}: ${baseSets} + ${setsAdd} = ${targetSets} sets (SC:${sc}, MPC:${pump})`);
          }

          // Prefill weights from last week
          newLog.weights = Array.from({ length: newLog.currentSets }, (_, i) => 
            prev.weight_used?.[i] ?? prev.weight_used?.[0] ?? 0
          );

          // Prefill reps based on RPE rule
          const prevReps: number[] = prev.actual_reps || [];
          const prevRpe: number[] = prev.rpe || [];
          if (prevReps.length && prevRpe.length && !isDeloadWeek) {
            // Use first set's RPE to determine rep progression (not during deload)
            const firstRpe = prevRpe[0] || 9;
            const repIncrease = firstRpe <= 8 ? 1 : 0;
            newLog.plannedReps = prevReps[0] + repIncrease;
          }

          // Resize arrays to match current sets
          newLog.actualReps = Array.from({ length: newLog.currentSets }, () => 0);
          newLog.rpe = Array.from({ length: newLog.currentSets }, () => 7);
          
        } else {
          // No previous data - handle deload and new exercises
          if (isDeloadWeek) {
            // ✅ DELOAD: reduce to 1/3 of sets and reps, minimum 1
            const deloadSets = Math.max(1, Math.round(newLog.currentSets * (1/3)));
            const deloadReps = Math.max(1, Math.round(newLog.plannedReps * (1/3)));
            newLog.plannedSets = deloadSets;
            newLog.currentSets = deloadSets;
            newLog.plannedReps = deloadReps;
            
            console.log(`DELOAD (no prev): ${log.exercise} - Sets: ${log.currentSets} → ${deloadSets}, Reps: ${log.plannedReps} → ${deloadReps}`);
          } else if (currentWeek >= 2) {
            // Apply SC + MPC even without previous data
            const sc = scResults[log.muscleGroup] as any;
            const pump = pumpByGroup[log.muscleGroup] || 'medium';
            const setsAdd = setsAdjustment(sc, pump);
            const targetSets = Math.max(1, newLog.currentSets + setsAdd);
            
            newLog.plannedSets = targetSets;
            newLog.currentSets = targetSets;
            
            console.log(`${log.exercise} (no prev): ${newLog.currentSets} + ${setsAdd} = ${targetSets} sets`);
          }
          
          // Initialize arrays
          newLog.actualReps = Array.from({ length: newLog.currentSets }, () => 0);
          newLog.weights = Array.from({ length: newLog.currentSets }, () => 0);
          newLog.rpe = Array.from({ length: newLog.currentSets }, () => 7);
        }
        
        return newLog;
      });

      console.log('Final initialized logs:', updatedLogs);
      setWorkoutLogs(updatedLogs);
      
    } catch (e) {
      console.error('Prefill initialization failed:', e);
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

        {/* SC (Soreness) Modal */}
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
              <RadioGroup onValueChange={(value) => {
                scModal.resolve(value);
              }}>
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
