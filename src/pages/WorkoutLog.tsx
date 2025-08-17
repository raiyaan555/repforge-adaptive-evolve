import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
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
  rpe: number[]; // Changed to array for per-set RPE and made mandatory
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
  const [completedMuscleGroups, setCompletedMuscleGroups] = useState<Set<string>>(new Set());
  const [muscleGroupFeedbacks, setMuscleGroupFeedbacks] = useState<Map<string, MuscleGroupFeedback>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (workoutId && user) {
      loadWorkout();
    }
  }, [workoutId, user]);

  useEffect(() => {
    // Load current week and day from active workout
    if (user && workoutId) {
      loadActiveWorkoutInfo();
    }
  }, [user, workoutId]);

  useEffect(() => {
    // Re-initialize workout logs when currentDay changes
    if (workout && currentDay) {
      console.log('Reinitializing workout logs for day:', currentDay);
      initializeWorkoutLogs(workout);
      // Reset muscle group completion state for new day
      setCompletedMuscleGroups(new Set());
      setMuscleGroupFeedbacks(new Map());
    }
  }, [currentDay, workout]);

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
      }
    } catch (error) {
      console.error('Error loading active workout info:', error);
    }
  };

  const loadWorkout = async () => {
    try {
      setLoading(true);
      
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
        // Don't initialize logs here - wait until currentDay is loaded
      }
    } catch (error) {
      console.error('Error loading workout:', error);
      toast({
        title: "Error",
        description: "Failed to load workout details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const initializeWorkoutLogs = async (workoutData: any) => {
    const structure = workoutData.workout_structure as WorkoutStructure;
    console.log('Workout structure:', structure);
    
    const dayKey = `day${currentDay}`;
    const dayWorkout = structure[dayKey] || [];
    
    console.log('Day key:', dayKey);
    console.log('Day workout:', dayWorkout);
    
    // Base logs from template
    const baseLogs: WorkoutLog[] = [];
    for (const mg of dayWorkout) {
      for (const ex of mg.exercises) {
        const defaultSets = ex.sets || 2;
        baseLogs.push({
          exercise: ex.name,
          muscleGroup: mg.muscleGroup,
          plannedSets: ex.sets || defaultSets,
          plannedReps: ex.reps || 0,
          actualReps: Array(defaultSets).fill(0),
          weights: Array(defaultSets).fill(0),
          rpe: Array(defaultSets).fill(7),
          completed: false,
          currentSets: defaultSets,
        });
      }
    }

    // Prefill for Week 2+ and deload weeks
    try {
      const muscleGroups = Array.from(new Set(baseLogs.map(l => l.muscleGroup)));

      // Ask SC at start: Week 2+ always; Week 1 only if muscle group repeats earlier in the same week
      const scByGroup: Record<string, 'none'|'medium'|'very_sore'|'extremely_sore'> = {};
      if (user) {
        for (const mg of muscleGroups) {
          let shouldAsk = currentWeek >= 2;
          if (!shouldAsk && currentWeek === 1) {
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
            const sc = await promptForSoreness(mg);
            if (sc) {
              scByGroup[mg] = sc as any;
              await supabase.from('muscle_soreness').insert({
                user_id: user.id,
                workout_date: new Date().toISOString().split('T')[0],
                muscle_group: mg,
                soreness_level: sc,
                healed: sc === 'none'
              });
            }
          }
        }
      }

      // Load last week's data for prefill
      const prevWeek = currentWeek - 1;
      let prevRows: any[] = [];
      if (prevWeek >= 1 && user) {
        const { data: rows } = await supabase
          .from('mesocycle')
          .select('exercise_name, muscle_group, actual_sets, actual_reps, weight_used, rpe, pump_level, day_number')
          .eq('user_id', user.id)
          .eq('plan_id', workoutId)
          .eq('week_number', prevWeek)
          .in('muscle_group', muscleGroups);
        prevRows = rows || [];
      }

      // Compute pump per group from last week (mode) and map to new scale
      const mapPump = (p?: string) => {
        if (!p) return 'medium';
        if (p === 'negligible' || p === 'low' || p === 'none') return 'none';
        if (p === 'moderate' || p === 'medium') return 'medium';
        return 'amazing';
      };
      const pumpByGroup: Record<string, 'none'|'medium'|'amazing'> = {};
      for (const mg of muscleGroups) {
        const pumps = prevRows.filter(r => r.muscle_group === mg).map(r => mapPump(r.pump_level));
        if (pumps.length) {
          const counts: Record<string, number> = {};
          pumps.forEach(p => counts[p] = (counts[p] || 0) + 1);
          pumpByGroup[mg] = (Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0] as any) || 'medium';
        } else {
          pumpByGroup[mg] = 'medium';
        }
      }

      // Helper: sets adjustment table
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
        if (sc === 'very_sore' && pump === 'none') return 0;
        if (sc === 'very_sore' && pump === 'medium') return 0;
        if (sc === 'very_sore' && pump === 'amazing') return 0;
        return 0;
      };

      // Map previous rows by exercise for quick lookup (latest day wins)
      const prevByExercise = new Map<string, any>();
      prevRows
        .sort((a,b)=> (b.day_number||0) - (a.day_number||0))
        .forEach(r => { if (!prevByExercise.has(r.exercise_name)) prevByExercise.set(r.exercise_name, r); });

      const updatedLogs = baseLogs.map(log => {
        const prev = prevByExercise.get(log.exercise);
        let newLog = { ...log };
        if (prev) {
          let baseSets = prev.actual_sets || log.currentSets;
          // Deload on final week
          if (currentWeek === workout.duration_weeks) {
            const deloadSets = Math.max(1, Math.round(baseSets * 0.65));
            newLog.plannedSets = deloadSets;
            newLog.currentSets = deloadSets;
          } else if ([5, 7, 9].includes(currentWeek)) {
            // Deload weeks 5, 7, 9 - reduce by 1/3
            const deloadSets = Math.max(1, Math.round(baseSets * 2/3));
            newLog.plannedSets = deloadSets;
            newLog.currentSets = deloadSets;
            // Also reduce reps by 1/3
            const prevReps: number[] = prev.actual_reps || [];
            if (prevReps.length) {
              const deloadReps = Math.max(1, Math.round(prevReps[0] * 2/3));
              newLog.plannedReps = deloadReps;
            }
          } else if (currentWeek >= 2) {
            const sc = scByGroup[log.muscleGroup];
            const pump = pumpByGroup[log.muscleGroup] || 'medium';
            const add = setsAdjustment(sc, pump);
            const targetSets = Math.max(1, baseSets + add);
            newLog.plannedSets = targetSets;
            newLog.currentSets = targetSets;
          }

          // Prefill weights from last week
          const targetLen = newLog.currentSets;
          newLog.weights = Array.from({ length: targetLen }, (_, i) => prev.weight_used?.[i] ?? 0);

          // Prefill planned reps from last week's RPE and reps (per set rule)
          const prevReps: number[] = prev.actual_reps || [];
          const prevRpe: number[] = prev.rpe || [];
          if (prevReps.length && prevRpe.length) {
            const firstTarget = prevReps[0] + (prevRpe[0] <= 8 ? 1 : 0);
            newLog.plannedReps = firstTarget;
          }

          // Resize arrays for reps and rpe to match target sets
          newLog.actualReps = Array.from({ length: newLog.currentSets }, (_, i) => 0);
          newLog.rpe = Array.from({ length: newLog.currentSets }, (_, i) => 7);
        } else if (currentWeek === workout.duration_weeks) {
          // No previous data but final week: still reduce default sets
          const deloadSets = Math.max(1, Math.round(newLog.currentSets * 0.65));
          newLog.plannedSets = deloadSets;
          newLog.currentSets = deloadSets;
          newLog.actualReps = Array.from({ length: newLog.currentSets }, () => 0);
          newLog.weights = Array.from({ length: newLog.currentSets }, () => 0);
          newLog.rpe = Array.from({ length: newLog.currentSets }, () => 7);
        } else if ([5, 7, 9].includes(currentWeek)) {
          // Deload weeks 5, 7, 9 - reduce by 1/3 (no previous data)
          const deloadSets = Math.max(1, Math.round(newLog.currentSets * 2/3));
          const deloadReps = Math.max(1, Math.round(newLog.plannedReps * 2/3));
          newLog.plannedSets = deloadSets;
          newLog.currentSets = deloadSets;
          newLog.plannedReps = deloadReps;
          newLog.actualReps = Array.from({ length: newLog.currentSets }, () => 0);
          newLog.weights = Array.from({ length: newLog.currentSets }, () => 0);
          newLog.rpe = Array.from({ length: newLog.currentSets }, () => 7);
        } else if (currentWeek >= 2) {
          // Apply SC + MPC based adjustment even when there is no previous week data
          const sc = scByGroup[log.muscleGroup];
          const pump = pumpByGroup[log.muscleGroup] || 'medium';
          const add = setsAdjustment(sc, pump);
          const targetSets = Math.max(1, (newLog.currentSets || 1) + add);
          newLog.plannedSets = targetSets;
          newLog.currentSets = targetSets;
          newLog.actualReps = Array.from({ length: targetSets }, () => 0);
          newLog.weights = Array.from({ length: targetSets }, () => 0);
          newLog.rpe = Array.from({ length: targetSets }, () => 7);
        }
        return newLog;
      });

      console.log('Initialized logs with prefill:', updatedLogs);
      setWorkoutLogs(updatedLogs);
    } catch (e) {
      console.error('Prefill initialization failed:', e);
      setWorkoutLogs(baseLogs);
    }
  };

  const updateWorkoutLog = (index: number, field: keyof WorkoutLog, value: any) => {
    const updatedLogs = [...workoutLogs];
    updatedLogs[index] = { ...updatedLogs[index], [field]: value };
    setWorkoutLogs(updatedLogs);
  };

  const updateSetData = (exerciseIndex: number, setIndex: number, field: 'reps' | 'weight' | 'rpe', value: number) => {
    const updatedLogs = [...workoutLogs];
    
    // Ensure arrays are long enough
    while (updatedLogs[exerciseIndex].actualReps.length <= setIndex) {
      updatedLogs[exerciseIndex].actualReps.push(0);
    }
    while (updatedLogs[exerciseIndex].weights.length <= setIndex) {
      updatedLogs[exerciseIndex].weights.push(0);
    }
    while (updatedLogs[exerciseIndex].rpe.length <= setIndex) {
      updatedLogs[exerciseIndex].rpe.push(7);
    }
    
    // Prevent NaN values - enforce zero as fallback (except for RPE which has a minimum of 1)
    const safeValue = isNaN(value) || value < 0 ? (field === 'rpe' ? 1 : 0) : value;
    
    if (field === 'reps') {
      updatedLogs[exerciseIndex].actualReps[setIndex] = safeValue;
    } else if (field === 'weight') {
      updatedLogs[exerciseIndex].weights[setIndex] = safeValue;
    } else if (field === 'rpe') {
      // Validate RPE is between 1 and 10
      if (value < 1 || value > 10) {
        toast({
          title: "Invalid RPE",
          description: "RPE must be between 1 and 10",
          variant: "destructive"
        });
        return; // Don't update if invalid
      }
      updatedLogs[exerciseIndex].rpe[setIndex] = safeValue;
    }
    
    // Auto-update completed status if all sets have valid data
    const isCompleted = isExerciseCompleted(updatedLogs[exerciseIndex]);
    if (isCompleted) {
      updatedLogs[exerciseIndex].completed = true;
    }
    
    setWorkoutLogs(updatedLogs);
    
    // Manual completion only; no auto-trigger on set updates
  };

  const addSet = (exerciseIndex: number) => {
    const updatedLogs = [...workoutLogs];
    updatedLogs[exerciseIndex].currentSets++;
    updatedLogs[exerciseIndex].actualReps.push(0);
    updatedLogs[exerciseIndex].weights.push(0);
    updatedLogs[exerciseIndex].rpe.push(7); // Default RPE for new set
    setWorkoutLogs(updatedLogs);
  };

  const removeSet = (exerciseIndex: number) => {
    const updatedLogs = [...workoutLogs];
    // Minimum 1 set requirement
    if (updatedLogs[exerciseIndex].currentSets > 1) {
      updatedLogs[exerciseIndex].currentSets--;
      updatedLogs[exerciseIndex].actualReps.pop();
      updatedLogs[exerciseIndex].weights.pop();
      updatedLogs[exerciseIndex].rpe.pop();
      
      // Reset completed status if removing sets
      updatedLogs[exerciseIndex].completed = false;
      
      setWorkoutLogs(updatedLogs);
    }
  };
  
  // Check if all exercises in a muscle group are completed and auto-complete the muscle group
  const checkMuscleGroupAutoCompletion = async (logs: WorkoutLog[]) => {
    const muscleGroups = getUniqueMuscleGroups();
    
    for (const muscleGroup of muscleGroups) {
      const exercises = logs.filter(log => log.muscleGroup === muscleGroup);
      const allCompleted = exercises.every(ex => isExerciseCompleted(ex) && ex.completed);
      
      if (allCompleted && !completedMuscleGroups.has(muscleGroup)) {
        // Auto-complete this muscle group
        await handleMuscleGroupComplete(muscleGroup);
      }
    }
  };

  // Check if exercise is completed (all sets have valid data including mandatory RPE)
  const isExerciseCompleted = (exercise: WorkoutLog) => {
    const setsToCheck = exercise.currentSets;
    const requireRpe = currentWeek === 1; // RPE required only in week 1
    for (let i = 0; i < setsToCheck; i++) {
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

  const handleMuscleGroupComplete = async (muscleGroup: string) => {
    console.log('Starting muscle group completion for:', muscleGroup);
    const exercises = getMuscleGroupExercises(muscleGroup);
    console.log('Exercises for muscle group:', exercises);
    
    console.log('Opening feedback modal for:', muscleGroup);
    setFeedbackModal({
      isOpen: true,
      muscleGroup,
      exercises
    });
    console.log('Feedback modal state set:', { isOpen: true, muscleGroup, exerciseCount: exercises.length });
  };

  const saveMuscleGroupFeedback = async () => {
    try {
      const { muscleGroup, exercises } = feedbackModal;
      console.log('Saving feedback for muscle group:', muscleGroup);
      console.log('Current completed muscle groups before:', Array.from(completedMuscleGroups));
      console.log('All unique muscle groups:', getUniqueMuscleGroups());
      
      // Store feedback for this muscle group (immutably)
      setMuscleGroupFeedbacks(prev => {
        const copy = new Map(prev);
        copy.set(muscleGroup, feedback);
        return copy;
      });
      setCompletedMuscleGroups(prev => new Set([...prev, muscleGroup]));
      
      // Save pump feedback for all muscle groups
      await supabase.from('pump_feedback').insert({
        user_id: user.id,
        workout_date: new Date().toISOString().split('T')[0],
        muscle_group: muscleGroup,
        pump_level: feedback.pumpLevel
      });
      
      // Save workout logs to mesocycle table for this muscle group
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
          actual_sets: exercise.actualReps.length,
          actual_reps: exercise.actualReps,
          weight_used: exercise.weights,
          weight_unit: weightUnit,
          rpe: exercise.rpe,
          rir: exercise.rpe.reduce((sum, rpe) => sum + rpe, 0) / exercise.rpe.length, // Average RPE
          pump_level: feedback.pumpLevel,
          is_sore: false,
          can_add_sets: false,
          feedback_given: true
        });
      }

      // Apply progression algorithm for this muscle group
      await applyProgressionAlgorithm(muscleGroup, exercises);

      setFeedbackModal({ isOpen: false, muscleGroup: '', exercises: [] });
      
      // Check if all muscle groups for the day are completed
      const allMuscleGroups = getUniqueMuscleGroups();
      const updatedCompletedGroups = new Set(completedMuscleGroups).add(muscleGroup);
      
      if (updatedCompletedGroups.size === allMuscleGroups.length) {
        // All muscle groups completed, end the workout day
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
      // Mark workout as completed in calendar
      await supabase.from('workout_calendar').insert({
        user_id: user.id,
        workout_date: new Date().toISOString().split('T')[0],
        status: 'completed',
        workout_summary: {
          exercises: workoutLogs.map(ex => ({
            name: ex.exercise,
            sets: ex.actualReps.length,
            reps: ex.actualReps,
            weights: ex.weights
          })),
          feedback: Array.from(muscleGroupFeedbacks.entries()).map(([mg, fb]) => ({
            muscle_group: mg,
            pump_level: fb.pumpLevel,
            is_sore: fb.isSore,
            can_add_sets: fb.canAddSets
          }))
        }
      });

      // Update active workout - get max days from workout structure
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
        // Save completed mesocycle before ending
        await saveCompletedMesocycle();
        
        toast({
          title: "Mesocycle Complete! 🎉",
          description: "Congratulations! You've completed your workout plan and it has been saved to your history."
        });
        
        // Navigate to past mesocycles to show the completed one
        navigate('/past-mesocycles');
        return;
      } else {
        toast({
          title: "Day Complete! 🎉",
          description: `Great job! Moving to Day ${nextDay}, Week ${nextWeek}`
        });
      }
      
      // Navigate back to current mesocycle
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

  const checkSorenessPrompt = async (muscleGroup: string) => {
    try {
      // Check if this muscle group has been trained before
      const { data: previousTraining } = await supabase
        .from('mesocycle')
        .select('*')
        .eq('user_id', user.id)
        .eq('muscle_group', muscleGroup)
        .order('created_at', { ascending: false })
        .limit(1);

      if (previousTraining && previousTraining.length > 0) {
        // Prompt for soreness feedback
        const sorenessLevel = await promptForSoreness(muscleGroup);
        if (sorenessLevel) {
          await supabase.from('muscle_soreness').insert({
            user_id: user.id,
            workout_date: new Date().toISOString().split('T')[0],
            muscle_group: muscleGroup,
            soreness_level: sorenessLevel,
            healed: sorenessLevel === 'none'
          });
        }
      }
    } catch (error) {
      console.error('Error checking soreness:', error);
    }
  };

  const promptForSoreness = (muscleGroup: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
      
      const dialog = document.createElement('div');
      dialog.className = 'bg-background border border-border rounded-lg max-w-md mx-4 shadow-lg';
      
      dialog.innerHTML = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4 text-foreground">How sore are you before training ${muscleGroup} today?</h3>
          <div class="space-y-2">
            <button data-value="none" class="w-full p-3 text-left border border-input rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">None/Negligible</button>
            <button data-value="medium" class="w-full p-3 text-left border border-input rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">Medium</button>
            <button data-value="very_sore" class="w-full p-3 text-left border border-input rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">Very Sore</button>
            <button data-value="extremely_sore" class="w-full p-3 text-left border border-input rounded-md hover:bg-accent hover:text-accent-foreground transition-colors">Extremely Sore</button>
          </div>
        </div>
      `;
      
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      
      overlay.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.hasAttribute('data-value')) {
          const value = target.getAttribute('data-value');
          document.body.removeChild(overlay);
          resolve(value);
        } else if (e.target === overlay) {
          document.body.removeChild(overlay);
          resolve(null);
        }
      });
    });
  };


  const saveCompletedMesocycle = async () => {
    try {
      // Get active workout details
      const { data: activeWorkout } = await supabase
        .from('active_workouts')
        .select('*')
        .eq('user_id', user.id)
        .eq('workout_id', workoutId)
        .maybeSingle();

      if (!activeWorkout) return;

      // Get all mesocycle data
      const { data: mesocycleData } = await supabase
        .from('mesocycle')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_id', workoutId);

      // Save the completed mesocycle
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

      // Delete the active workout
      await supabase
        .from('active_workouts')
        .delete()
        .eq('user_id', user.id)
        .eq('workout_id', workoutId);

    } catch (error) {
      console.error('Error saving completed mesocycle:', error);
      toast({
        title: "Error saving mesocycle",
        description: "There was an error saving your completed mesocycle.",
        variant: "destructive"
      });
    }
  };

  const applyProgressionAlgorithm = async (muscleGroup: string, exercises: WorkoutLog[]) => {
    try {
      const { pumpLevel } = feedback;
      
      // Get soreness data for this muscle group
      const { data: sorenessData } = await supabase
        .from('muscle_soreness')
        .select('*')
        .eq('user_id', user.id)
        .eq('muscle_group', muscleGroup)
        .order('created_at', { ascending: false })
        .limit(1);

      const isHealed = sorenessData?.[0]?.healed || true;
      let setsAdjustment = 0;

      // Adaptive algorithm based on pump and soreness (legacy; actual prefill handled at start)
      if (pumpLevel === 'none') {
        setsAdjustment = isHealed ? 3 : 1;
      } else if (pumpLevel === 'medium') {
        setsAdjustment = 1;
      } else if (pumpLevel === 'amazing') {
        setsAdjustment = isHealed ? 1 : 0;
      }

      // Final week deload placeholder logic (actual applied during prefill)
      if (currentWeek === workout.duration_weeks) {
        setsAdjustment = Math.max(1, Math.floor((exercises[0]?.plannedSets || 1) * 0.65));
      }

      // Weight and rep progression
      for (const exercise of exercises) {
        const avgReps = exercise.actualReps.reduce((sum, reps) => sum + reps, 0) / exercise.actualReps.length;
        const avgWeight = exercise.weights.reduce((sum, weight) => sum + weight, 0) / exercise.weights.length;
        
        let newWeight = avgWeight;
        let newReps = exercise.plannedReps;
        
        // If user matched target reps, increase weight
        if (avgReps >= exercise.plannedReps) {
          newWeight += 2.5; // Increase by 2.5 lbs/kg
        }
        
        // If user exceeded reps significantly, increase reps for next week
        if (avgReps > exercise.plannedReps + 2) {
          newReps += 1;
        }

        console.log(`Progression for ${exercise.exercise}: +${setsAdjustment} sets, ${newReps} reps, ${newWeight}${weightUnit}`);
      }
      
      console.log(`Applied progression algorithm: ${muscleGroup} +${setsAdjustment} sets`);
    } catch (error) {
      console.error('Error applying progression algorithm:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">Loading workout...</div>
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
            </div>
          </div>
          
        </div>

        <div className="space-y-4 sm:space-y-6">
          {getUniqueMuscleGroups().map((muscleGroup) => {
            const exercises = getMuscleGroupExercises(muscleGroup);
            const isCompleted = exercises.every(ex => isExerciseCompleted(ex) && ex.completed);
            const hasCompletedFeedback = completedMuscleGroups.has(muscleGroup);
            
            console.log(`Muscle group ${muscleGroup}: isCompleted=${isCompleted}, hasCompletedFeedback=${hasCompletedFeedback}, exercises:`, exercises.map(ex => ({name: ex.exercise, completed: ex.completed})));
            
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
                    variant="energy"
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
                           const exerciseCompleted = isExerciseCompleted(exercise);
                           
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
                                 Sets: {exercise.currentSets}
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
                                             className={`h-8 text-sm ${!exercise.rpe[setIndex] || exercise.rpe[setIndex] < 1 || exercise.rpe[setIndex] > 10 ? 'border-destructive' : ''}`}
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

        <Dialog open={feedbackModal.isOpen} onOpenChange={(open) => setFeedbackModal(prev => ({ ...prev, isOpen: open }))}>
          <DialogContent className="max-w-sm sm:max-w-md mx-4">
            <DialogHeader>
              <DialogTitle className="text-lg">Muscle Group Feedback</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {(() => {
                console.log('Rendering feedback modal for muscle group:', feedbackModal.muscleGroup);
                console.log('Modal isOpen:', feedbackModal.isOpen);
                return null;
              })()}
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


              <Button onClick={() => {
                console.log('Save Feedback button clicked for:', feedbackModal.muscleGroup);
                saveMuscleGroupFeedback();
              }} className="w-full">
                Save Feedback
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}