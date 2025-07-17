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
            logs.push({
              exercise: exercise.name,
              muscleGroup: muscleGroupData.muscleGroup,
              plannedSets: exercise.sets,
              plannedReps: exercise.reps,
              actualReps: new Array(exercise.sets).fill(0),
              weights: new Array(exercise.sets).fill(0),
              rir: 0,
              completed: false
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
    if (field === 'reps') {
      updatedLogs[exerciseIndex].actualReps[setIndex] = value;
    } else {
      updatedLogs[exerciseIndex].weights[setIndex] = value;
    }
    setWorkoutLogs(updatedLogs);
  };

  const getMuscleGroupExercises = (muscleGroup: string) => {
    return workoutLogs.filter(log => log.muscleGroup === muscleGroup);
  };

  const getUniqueMuscleGroups = () => {
    return Array.from(new Set(workoutLogs.map(log => log.muscleGroup)));
  };

  const handleMuscleGroupComplete = (muscleGroup: string) => {
    const exercises = getMuscleGroupExercises(muscleGroup);
    setFeedbackModal({
      isOpen: true,
      muscleGroup,
      exercises
    });
  };

  const saveFeedback = async () => {
    try {
      const { muscleGroup, exercises } = feedbackModal;
      
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
      const nextDay = currentDay < workout.days_per_week ? currentDay + 1 : 1;
      const nextWeek = currentDay < workout.days_per_week ? currentWeek : currentWeek + 1;
      
      await supabase
        .from('active_workouts')
        .update({
          current_day: nextDay,
          current_week: nextWeek,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('workout_id', workoutId);

      // Apply progression algorithm if moving to new week
      if (nextWeek > currentWeek) {
        await applyProgressionAlgorithm(muscleGroup, exercises);
      }

      toast({
        title: "Workout Complete! 🎉",
        description: `Great job! Moving to Day ${nextDay}, Week ${nextWeek}`
      });

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
    const { pumpLevel, isSore, canAddSets } = feedback;
    let setsAdjustment = 0;

    // Progression algorithm
    if (pumpLevel === 'negligible' || pumpLevel === 'low') {
      if (!isSore) {
        setsAdjustment = 3;
      } else {
        setsAdjustment = 1;
      }
    } else if (pumpLevel === 'moderate') {
      setsAdjustment = isSore ? 1 : 2;
    } else if (pumpLevel === 'amazing') {
      setsAdjustment = isSore ? 0 : 1;
    }

    // Update workout structure for next week
    if (setsAdjustment > 0) {
      // This would typically update the workout plan for next week
      // For now, we'll just log the adjustment
      console.log(`Adjusting ${muscleGroup} by ${setsAdjustment} sets for next week`);
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
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Array.from({ length: exercise.plannedSets }).map((_, setIndex) => (
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
                                      onChange={(e) => updateSetData(originalIndex, setIndex, 'weight', Number(e.target.value))}
                                      className="h-8"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">
                                      Actual Reps
                                    </Label>
                                    <Input
                                      type="number"
                                      value={exercise.actualReps[setIndex] || ''}
                                      onChange={(e) => updateSetData(originalIndex, setIndex, 'reps', Number(e.target.value))}
                                      className="h-8"
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