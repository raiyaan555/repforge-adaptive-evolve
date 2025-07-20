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
  rir?: number;
  completed: boolean;
  currentSets: number;
}

interface MuscleGroupFeedback {
  pumpLevel: 'negligible' | 'low' | 'moderate' | 'amazing';
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
    pumpLevel: 'moderate',
    isSore: false,
    canAddSets: false
  });
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

  const loadActiveWorkoutInfo = async () => {
    try {
      const { data: activeWorkout } = await supabase
        .from('active_workouts')
        .select('current_week, current_day')
        .eq('user_id', user.id)
        .eq('workout_id', workoutId)
        .single();
        
      if (activeWorkout) {
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
        .single();

      if (!defaultWorkout) {
        const { data: customWorkout } = await supabase
          .from('custom_workouts')
          .select('*')
          .eq('id', workoutId)
          .eq('user_id', user.id)
          .single();
        
        if (customWorkout) {
          defaultWorkout = customWorkout;
        }
      }

      if (defaultWorkout) {
        setWorkout(defaultWorkout);
        initializeWorkoutLogs(defaultWorkout);
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

  const initializeWorkoutLogs = (workoutData: any) => {
    const structure = workoutData.workout_structure as WorkoutStructure;
    console.log('Workout structure:', structure);
    
    // Get current day from active workout or default to day 1
    const dayKey = `day${currentDay}`;
    const dayWorkout = structure[dayKey] || [];
    
    console.log('Day key:', dayKey);
    console.log('Day workout:', dayWorkout);
    
    const logs: WorkoutLog[] = [];
    
    if (Array.isArray(dayWorkout)) {
      dayWorkout.forEach((muscleGroupData) => {
        if (muscleGroupData.exercises && Array.isArray(muscleGroupData.exercises)) {
          muscleGroupData.exercises.forEach((exercise) => {
            // Initialize with defaults: 1 set, empty reps/weight, RPE 7 (Week 1)
            const defaultSets = 1;
            const defaultRpe = 7;
            
            logs.push({
              exercise: exercise.name,
              muscleGroup: muscleGroupData.muscleGroup,
              plannedSets: defaultSets,
              plannedReps: 0, // Empty, to be filled by user
              actualReps: [0], // Start with one empty set
              weights: [0], // Start with one empty set
              rir: defaultRpe,
              completed: false,
              currentSets: defaultSets
            });
          });
        }
      });
    }
    
    console.log('Initialized logs:', logs);
    setWorkoutLogs(logs);
  };

  const updateWorkoutLog = (index: number, field: keyof WorkoutLog, value: any) => {
    const updatedLogs = [...workoutLogs];
    updatedLogs[index] = { ...updatedLogs[index], [field]: value };
    setWorkoutLogs(updatedLogs);
  };

  const updateSetData = (exerciseIndex: number, setIndex: number, field: 'reps' | 'weight', value: number) => {
    const updatedLogs = [...workoutLogs];
    
    // Ensure arrays are long enough
    while (updatedLogs[exerciseIndex].actualReps.length <= setIndex) {
      updatedLogs[exerciseIndex].actualReps.push(0);
    }
    while (updatedLogs[exerciseIndex].weights.length <= setIndex) {
      updatedLogs[exerciseIndex].weights.push(0);
    }
    
    // Prevent NaN values - enforce zero as fallback
    const safeValue = isNaN(value) || value < 0 ? 0 : value;
    
    if (field === 'reps') {
      updatedLogs[exerciseIndex].actualReps[setIndex] = safeValue;
    } else {
      updatedLogs[exerciseIndex].weights[setIndex] = safeValue;
    }
    setWorkoutLogs(updatedLogs);
  };

  const addSet = (exerciseIndex: number) => {
    const updatedLogs = [...workoutLogs];
    updatedLogs[exerciseIndex].currentSets++;
    updatedLogs[exerciseIndex].actualReps.push(0);
    updatedLogs[exerciseIndex].weights.push(0);
    setWorkoutLogs(updatedLogs);
  };

  const removeSet = (exerciseIndex: number) => {
    const updatedLogs = [...workoutLogs];
    if (updatedLogs[exerciseIndex].currentSets > 0) {
      updatedLogs[exerciseIndex].currentSets--;
      updatedLogs[exerciseIndex].actualReps.pop();
      updatedLogs[exerciseIndex].weights.pop();
      setWorkoutLogs(updatedLogs);
    }
  };

  const getMuscleGroupExercises = (muscleGroup: string) => {
    return workoutLogs.filter(log => log.muscleGroup === muscleGroup);
  };

  const getUniqueMuscleGroups = () => {
    return Array.from(new Set(workoutLogs.map(log => log.muscleGroup)));
  };

  const handleMuscleGroupComplete = async (muscleGroup: string) => {
    const exercises = getMuscleGroupExercises(muscleGroup);
    
    // Check for soreness feedback if muscle group has been trained before
    await checkSorenessPrompt(muscleGroup);
    
    setFeedbackModal({
      isOpen: true,
      muscleGroup,
      exercises
    });
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
      const dialog = document.createElement('div');
      dialog.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;">
          <div style="background: white; padding: 24px; border-radius: 8px; max-width: 400px;">
            <h3 style="margin-bottom: 16px;">How sore did you get after you worked out ${muscleGroup} last time?</h3>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <button data-value="none" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px; background: white;">No soreness</button>
              <button data-value="light" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px; background: white;">Light soreness</button>
              <button data-value="moderate" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px; background: white;">Moderate soreness</button>
              <button data-value="severe" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px; background: white;">Severe soreness</button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(dialog);
      
      dialog.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.hasAttribute('data-value')) {
          const value = target.getAttribute('data-value');
          document.body.removeChild(dialog);
          resolve(value);
        }
      });
    });
  };

  const saveFeedback = async () => {
    try {
      const { muscleGroup, exercises } = feedbackModal;
      
      // Save pump feedback
      await supabase.from('pump_feedback').insert({
        user_id: user.id,
        workout_date: new Date().toISOString().split('T')[0],
        muscle_group: muscleGroup,
        pump_level: feedback.pumpLevel
      });
      
      // Save workout logs to mesocycle table
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
          rir: exercise.rir,
          pump_level: feedback.pumpLevel,
          is_sore: feedback.isSore,
          can_add_sets: feedback.canAddSets,
          feedback_given: true
        });
      }

      // Mark workout as completed in calendar
      await supabase.from('workout_calendar').insert({
        user_id: user.id,
        workout_date: new Date().toISOString().split('T')[0],
        status: 'completed',
        workout_summary: {
          exercises: exercises.map(ex => ({
            name: ex.exercise,
            sets: ex.actualReps.length,
            reps: ex.actualReps,
            weights: ex.weights
          })),
          feedback: {
            pump_level: feedback.pumpLevel,
            is_sore: feedback.isSore,
            can_add_sets: feedback.canAddSets
          }
        }
      });

      // Update active workout - move to next day
      const nextDay = currentDay < 8 ? currentDay + 1 : 1;
      const nextWeek = currentDay < 8 ? currentWeek : currentWeek + 1;
      
      await supabase
        .from('active_workouts')
        .update({
          current_day: nextDay,
          current_week: nextWeek,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('workout_id', workoutId);

      // Apply progression algorithm
      await applyProgressionAlgorithm(muscleGroup, exercises);

      // Check if mesocycle is complete
      if (nextWeek > workout.duration_weeks) {
        toast({
          title: "Mesocycle Complete! 🎉",
          description: "Congratulations! You've completed your workout plan."
        });
        // End the workout
        await supabase
          .from('active_workouts')
          .delete()
          .eq('user_id', user.id)
          .eq('workout_id', workoutId);
      } else {
        toast({
          title: "Muscle Group Complete! 💪",
          description: `Great job! Moving to Day ${nextDay}, Week ${nextWeek}`
        });
      }

      setFeedbackModal({ isOpen: false, muscleGroup: '', exercises: [] });
      
      // Navigate back to current mesocycle
      navigate('/current-mesocycle');
    } catch (error) {
      console.error('Error saving feedback:', error);
      toast({
        title: "Error",
        description: "Failed to save workout feedback",
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

      // Adaptive algorithm based on pump and soreness
      if (pumpLevel === 'negligible' || pumpLevel === 'low') {
        setsAdjustment = isHealed ? 3 : 1;
      } else if (pumpLevel === 'moderate') {
        setsAdjustment = isHealed ? 2 : 1;
      } else if (pumpLevel === 'amazing') {
        setsAdjustment = isHealed ? 1 : 0;
      }

      // For final week, reduce to 1/3 of second last week
      if (currentWeek === workout.duration_weeks - 1) {
        setsAdjustment = Math.max(1, Math.floor(exercises[0]?.plannedSets / 3));
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
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/workouts')}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Workouts
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Day {currentDay} - Workout Log</h1>
              <p className="text-muted-foreground">{workout.name} - Week {currentWeek}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="unit-toggle">kg</Label>
              <Switch
                id="unit-toggle"
                checked={weightUnit === 'lbs'}
                onCheckedChange={(checked) => setWeightUnit(checked ? 'lbs' : 'kg')}
              />
              <Label htmlFor="unit-toggle">lbs</Label>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {getUniqueMuscleGroups().map((muscleGroup) => {
            const exercises = getMuscleGroupExercises(muscleGroup);
            const isCompleted = exercises.every(ex => ex.completed);
            
            return (
              <Card key={muscleGroup} className="w-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {muscleGroup}
                      {isCompleted && <Badge variant="default">Completed</Badge>}
                    </CardTitle>
                    <Button
                      onClick={() => handleMuscleGroupComplete(muscleGroup)}
                      disabled={!isCompleted}
                      variant="outline"
                    >
                      Complete Muscle Group
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {exercises.map((exercise, exerciseIndex) => {
                      const originalIndex = workoutLogs.findIndex(log => log === exercise);
                      
                      return (
                          <div key={`${muscleGroup}-${exerciseIndex}`} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="font-semibold">{exercise.exercise}</h3>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">
                                  {exercise.plannedSets} sets × {exercise.plannedReps} reps
                                </Badge>
                                <Button
                                  variant={exercise.completed ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => updateWorkoutLog(originalIndex, 'completed', !exercise.completed)}
                                >
                                  {exercise.completed ? 'Completed' : 'Mark Complete'}
                                </Button>
                              </div>
                            </div>
                            
                            <div className="mb-4 flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addSet(originalIndex)}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Add Set
                              </Button>
                              {exercise.currentSets > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeSet(originalIndex)}
                                >
                                  <Minus className="h-4 w-4 mr-1" />
                                  Remove Set
                                </Button>
                              )}
                              <span className="text-sm text-muted-foreground">
                                Current sets: {Math.max(exercise.plannedSets, exercise.currentSets)}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {Array.from({ length: Math.max(exercise.plannedSets, exercise.currentSets) }).map((_, setIndex) => (
                                <div key={setIndex} className="border rounded p-3">
                                  <Label className="text-sm font-medium mb-2 block">
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
                                          placeholder="e.g. 20 kg"
                                          onChange={(e) => updateSetData(originalIndex, setIndex, 'weight', Number(e.target.value) || 0)}
                                          className="h-8"
                                          min="0"
                                          step="0.5"
                                        />
                                    </div>
                                    <div>
                                      <Label className="text-xs text-muted-foreground">
                                        Actual Reps
                                      </Label>
                                       <Input
                                         type="number"
                                         value={exercise.actualReps[setIndex] || ''}
                                         placeholder="e.g. 12"
                                         onChange={(e) => updateSetData(originalIndex, setIndex, 'reps', Number(e.target.value) || 0)}
                                         className="h-8"
                                         min="1"
                                       />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          
                          <div className="mt-4 flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Label className="text-sm">RIR (Optional):</Label>
                              <Input
                                type="number"
                                value={exercise.rir || ''}
                                onChange={(e) => updateWorkoutLog(originalIndex, 'rir', Number(e.target.value))}
                                className="w-20 h-8"
                                min="0"
                                max="10"
                              />
                            </div>
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
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Muscle Group Feedback</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div>
                <Label className="text-sm font-medium mb-3 block">
                  Pump Level for {feedbackModal.muscleGroup}
                </Label>
                <RadioGroup
                  value={feedback.pumpLevel}
                  onValueChange={(value) => setFeedback(prev => ({ ...prev, pumpLevel: value as any }))}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="negligible" id="negligible" />
                    <Label htmlFor="negligible">Negligible</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low" id="low" />
                    <Label htmlFor="low">Low</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="moderate" id="moderate" />
                    <Label htmlFor="moderate">Moderate</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="amazing" id="amazing" />
                    <Label htmlFor="amazing">Amazing</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Are you still sore today?</Label>
                  <Switch
                    checked={feedback.isSore}
                    onCheckedChange={(checked) => setFeedback(prev => ({ ...prev, isSore: checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Can you add more sets?</Label>
                  <Switch
                    checked={feedback.canAddSets}
                    onCheckedChange={(checked) => setFeedback(prev => ({ ...prev, canAddSets: checked }))}
                  />
                </div>
              </div>

              <Button onClick={saveFeedback} className="w-full">
                Save Feedback
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}