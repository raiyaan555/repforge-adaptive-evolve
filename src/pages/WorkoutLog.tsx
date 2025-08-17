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

  // Add loading state for processing feedback
  const [isProcessingFeedback, setIsProcessingFeedback] = useState(false);

  // Single useEffect to handle all data loading sequentially
  useEffect(() => {
    let isMounted = true;
    
    const initializeAllData = async () => {
      if (!user || !workoutId) return;
      
      setLoading(true);
      
      try {
        // 1. Load workout data first
        const workoutData = await loadWorkout();
        if (!isMounted || !workoutData) return;
        
        // 2. Load active workout info (week/day)
        const activeInfo = await loadActiveWorkoutInfo();
        if (!isMounted) return;
        
        // 3. Initialize logs with proper data
        await initializeWorkoutLogs(workoutData);
        
        // 4. Reset state for new day
        if (isMounted) {
          setCompletedMuscleGroups(new Set());
          setMuscleGroupFeedbacks(new Map());
        }
      } catch (error) {
        console.error('Error initializing workout data:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    initializeAllData();
    
    return () => { isMounted = false; };
  }, [user, workoutId]);

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
        return activeWorkout; // Return the data
      }
      return null;
    } catch (error) {
      console.error('Error loading active workout info:', error);
      return null;
    }
  };

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
        return defaultWorkout; // Return the data
      }
      return null;
    } catch (error) {
      console.error('Error loading workout:', error);
      toast({
        title: "Error",
        description: "Failed to load workout details",
        variant: "destructive"
      });
      return null;
    }
  };

  const initializeWorkoutLogs = async (workoutData: any) => {
    // Null safety check
    if (!workoutData || !workoutData.workout_structure) {
      console.error('Workout data is null or missing structure:', workoutData);
      return;
    }
    
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

    console.log('Initialized logs:', baseLogs);
    setWorkoutLogs(baseLogs);
  };

  const updateWorkoutLog = (index: number, field: keyof WorkoutLog, value: any) => {
    const updatedLogs = [...workoutLogs];
    updatedLogs[index] = { ...updatedLogs[index], [field]: value };
    setWorkoutLogs(updatedLogs);
  };

  const updateSetData = (exerciseIndex: number, setIndex: number, field: 'reps' | 'weight' | 'rpe', value: number) => {
    const updatedLogs = [...workoutLogs];
    const exercise = updatedLogs[exerciseIndex];
    
    // Validation
    if (!exercise || setIndex < 0 || setIndex >= exercise.currentSets) return;
    
    // CRITICAL FIX: Ensure all arrays match currentSets length
    while (exercise.actualReps.length < exercise.currentSets) {
      exercise.actualReps.push(0);
    }
    while (exercise.weights.length < exercise.currentSets) {
      exercise.weights.push(0);
    }
    while (exercise.rpe.length < exercise.currentSets) {
      exercise.rpe.push(7);
    }
    
    // Truncate if too long
    exercise.actualReps = exercise.actualReps.slice(0, exercise.currentSets);
    exercise.weights = exercise.weights.slice(0, exercise.currentSets);
    exercise.rpe = exercise.rpe.slice(0, exercise.currentSets);
    
    // Validate value
    let safeValue = value;
    if (field === 'rpe') {
      if (value < 1 || value > 10 || isNaN(value)) {
        toast({
          title: "Invalid RPE",
          description: "RPE must be between 1 and 10",
          variant: "destructive"
        });
        return;
      }
    } else if (isNaN(value) || value < 0) {
      safeValue = 0;
    }
    
    // Update the field
    if (field === 'reps') exercise.actualReps[setIndex] = safeValue;
    else if (field === 'weight') exercise.weights[setIndex] = safeValue;
    else if (field === 'rpe') exercise.rpe[setIndex] = safeValue;
    
    // Update completion status
    exercise.completed = isExerciseCompleted(exercise);
    
    setWorkoutLogs(updatedLogs);
  };

  const addSet = (exerciseIndex: number) => {
    const updatedLogs = [...workoutLogs];
    const exercise = updatedLogs[exerciseIndex];
    
    exercise.currentSets++;
    exercise.actualReps.push(0);
    exercise.weights.push(0);
    exercise.rpe.push(7);
    
    // Reset completion status since we added a set
    exercise.completed = false;
    
    setWorkoutLogs(updatedLogs);
  };

  const removeSet = (exerciseIndex: number) => {
    const updatedLogs = [...workoutLogs];
    const exercise = updatedLogs[exerciseIndex];
    
    // Minimum 1 set requirement
    if (exercise.currentSets <= 1) return;
    
    exercise.currentSets--;
    exercise.actualReps.pop();
    exercise.weights.pop();
    exercise.rpe.pop();
    
    // Reset completion status
    exercise.completed = false;
    
    setWorkoutLogs(updatedLogs);
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

  const getUniqueMuscleGroups = () => {
    return Array.from(new Set(workoutLogs.map(log => log.muscleGroup)));
  };

  const getExercisesForMuscleGroup = (muscleGroup: string) => {
    return workoutLogs.filter(log => log.muscleGroup === muscleGroup);
  };

  const isMuscleGroupComplete = (muscleGroup: string) => {
    const exercises = getExercisesForMuscleGroup(muscleGroup);
    return exercises.length > 0 && exercises.every(exercise => isExerciseCompleted(exercise));
  };

  const openFeedbackModal = (muscleGroup: string) => {
    const exercises = getExercisesForMuscleGroup(muscleGroup);
    setFeedbackModal({
      isOpen: true,
      muscleGroup,
      exercises
    });
    
    // Reset feedback to defaults
    setFeedback({
      pumpLevel: 'medium',
      isSore: false,
      canAddSets: false
    });
  };

  const saveFeedback = async () => {
    if (!user || !feedbackModal.muscleGroup) return;
    
    setIsProcessingFeedback(true);
    
    try {
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Save pump feedback
      await supabase.from('pump_feedback').insert({
        user_id: user.id,
        workout_date: currentDate,
        muscle_group: feedbackModal.muscleGroup,
        pump_level: feedback.pumpLevel
      });

      // Save muscle soreness if applicable
      if (feedback.isSore) {
        await supabase.from('muscle_soreness').insert({
          user_id: user.id,
          workout_date: currentDate,
          muscle_group: feedbackModal.muscleGroup,
          soreness_level: 'medium', // Default soreness level
          healed: false
        });
      }

      // Save mesocycle data for each exercise
      for (const exercise of feedbackModal.exercises) {
        await supabase.from('mesocycle').insert({
          user_id: user.id,
          plan_id: workoutId,
          week_number: currentWeek,
          day_number: currentDay,
          workout_name: workout?.name || 'Unknown Workout',
          exercise_name: exercise.exercise,
          muscle_group: exercise.muscleGroup,
          planned_sets: exercise.plannedSets,
          planned_reps: exercise.plannedReps,
          actual_sets: exercise.currentSets,
          actual_reps: exercise.actualReps,
          weight_used: exercise.weights,
          weight_unit: weightUnit,
          rpe: exercise.rpe,
          pump_level: feedback.pumpLevel,
          is_sore: feedback.isSore,
          can_add_sets: feedback.canAddSets,
          feedback_given: true
        });
      }

      // Update completion status
      setCompletedMuscleGroups(prev => new Set([...prev, feedbackModal.muscleGroup]));
      setMuscleGroupFeedbacks(prev => new Map([...prev, [feedbackModal.muscleGroup, feedback]]));

      // Close modal
      setFeedbackModal({ isOpen: false, muscleGroup: '', exercises: [] });
      
      toast({
        title: "Feedback Saved",
        description: `Feedback for ${feedbackModal.muscleGroup} has been saved successfully.`
      });

    } catch (error) {
      console.error('Error saving feedback:', error);
      toast({
        title: "Error",
        description: "Failed to save feedback. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessingFeedback(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading workout...</p>
        </div>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Workout not found</h2>
          <p className="text-muted-foreground mb-4">The workout you're looking for doesn't exist or you don't have access to it.</p>
          <Button onClick={() => navigate('/workouts')}>
            Back to Workouts
          </Button>
        </div>
      </div>
    );
  }

  const uniqueMuscleGroups = getUniqueMuscleGroups();

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={() => navigate('/workouts')}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Workouts
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{workout.name}</h1>
          <p className="text-muted-foreground">Week {currentWeek}, Day {currentDay}</p>
        </div>
      </div>

      <div className="grid gap-6">
        {uniqueMuscleGroups.map((muscleGroup) => {
          const exercises = getExercisesForMuscleGroup(muscleGroup);
          const isComplete = isMuscleGroupComplete(muscleGroup);
          const isCompleted = completedMuscleGroups.has(muscleGroup);
          
          return (
            <Card key={muscleGroup} className="relative">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-xl">{muscleGroup}</CardTitle>
                <div className="flex items-center gap-2">
                  {isCompleted && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Completed
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    onClick={() => openFeedbackModal(muscleGroup)}
                    disabled={!isComplete || isCompleted}
                    className={isComplete && !isCompleted ? "bg-primary" : ""}
                  >
                    {isCompleted ? "Completed" : isComplete ? "Complete Group" : "Fill Data First"}
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {exercises.map((exercise, exerciseIndex) => {
                  const globalIndex = workoutLogs.findIndex(log => 
                    log.exercise === exercise.exercise && 
                    log.muscleGroup === exercise.muscleGroup
                  );
                  
                  return (
                    <div key={`${exercise.exercise}-${exerciseIndex}`} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{exercise.exercise}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {exercise.currentSets} sets
                          </span>
                          {exercise.completed && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                              Complete
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {Array.from({ length: exercise.currentSets }, (_, setIndex) => (
                          <div key={setIndex} className="grid grid-cols-4 gap-2 items-center">
                            <Label className="text-sm font-medium">Set {setIndex + 1}</Label>
                            
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Weight ({weightUnit})</Label>
                              <Input
                                type="number"
                                placeholder="0"
                                value={exercise.weights[setIndex] || ''}
                                onChange={(e) => updateSetData(globalIndex, setIndex, 'weight', parseFloat(e.target.value) || 0)}
                                className="h-8"
                              />
                            </div>
                            
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Reps</Label>
                              <Input
                                type="number"
                                placeholder="0"
                                value={exercise.actualReps[setIndex] || ''}
                                onChange={(e) => updateSetData(globalIndex, setIndex, 'reps', parseInt(e.target.value) || 0)}
                                className="h-8"
                              />
                            </div>
                            
                            {currentWeek === 1 && (
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">RPE</Label>
                                <Input
                                  type="number"
                                  placeholder="7"
                                  min="1"
                                  max="10"
                                  value={exercise.rpe[setIndex] || ''}
                                  onChange={(e) => updateSetData(globalIndex, setIndex, 'rpe', parseInt(e.target.value) || 7)}
                                  className="h-8"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addSet(globalIndex)}
                          className="h-8 px-3"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Set
                        </Button>
                        
                        {exercise.currentSets > 1 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeSet(globalIndex)}
                            className="h-8 px-3"
                          >
                            <Minus className="h-3 w-3 mr-1" />
                            Remove Set
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Feedback Modal */}
      <Dialog open={feedbackModal.isOpen} onOpenChange={(open) => 
        !isProcessingFeedback && setFeedbackModal(prev => ({ ...prev, isOpen: open }))
      }>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete {feedbackModal.muscleGroup}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">How was the muscle pump?</Label>
              <RadioGroup
                value={feedback.pumpLevel}
                onValueChange={(value) => setFeedback(prev => ({ ...prev, pumpLevel: value as any }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="none" id="pump-none" />
                  <Label htmlFor="pump-none" className="text-sm">None / Negligible</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="medium" id="pump-medium" />
                  <Label htmlFor="pump-medium" className="text-sm">Medium</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="amazing" id="pump-amazing" />
                  <Label htmlFor="pump-amazing" className="text-sm">Amazing</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is-sore"
                checked={feedback.isSore}
                onCheckedChange={(checked) => setFeedback(prev => ({ ...prev, isSore: checked }))}
              />
              <Label htmlFor="is-sore" className="text-sm">Muscle feels sore</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="can-add-sets"
                checked={feedback.canAddSets}
                onCheckedChange={(checked) => setFeedback(prev => ({ ...prev, canAddSets: checked }))}
              />
              <Label htmlFor="can-add-sets" className="text-sm">Could add more sets</Label>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setFeedbackModal(prev => ({ ...prev, isOpen: false }))}
              disabled={isProcessingFeedback}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={saveFeedback}
              disabled={isProcessingFeedback}
              className="flex-1"
            >
              {isProcessingFeedback ? "Saving..." : "Save & Continue"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}