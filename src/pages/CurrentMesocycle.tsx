import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, Play, Square, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ActiveWorkout {
  id: string;
  workout_id: string;
  workout_type: 'default' | 'custom';
  started_at: string;
  current_week: number;
  current_day: number;
}

interface WorkoutDetails {
  id: string;
  name: string;
  program_type: string;
  duration_weeks: number;
  days_per_week: number;
  workout_structure: any;
}

export function CurrentMesocycle() {
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
  const [workoutDetails, setWorkoutDetails] = useState<WorkoutDetails | null>(null);
  const [currentDayExercises, setCurrentDayExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadActiveWorkout();
    }
  }, [user]);

  const loadActiveWorkout = async () => {
    if (!user) return;

    try {
      // Get active workout
      const { data: activeData, error: activeError } = await supabase
        .from('active_workouts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (activeError) throw activeError;

      if (activeData) {
        setActiveWorkout(activeData as ActiveWorkout);
        
        // Get workout details
        const tableName = activeData.workout_type === 'default' ? 'default_workouts' : 'custom_workouts';
        const { data: workoutData, error: workoutError } = await supabase
          .from(tableName)
          .select('*')
          .eq('id', activeData.workout_id)
          .maybeSingle();

        if (workoutError || !workoutData) {
          // Workout no longer exists, clean up active workout
          await supabase
            .from('active_workouts')
            .delete()
            .eq('id', activeData.id);
          
          toast({
            title: "Workout not found",
            description: "Your active workout was removed because the plan no longer exists.",
            variant: "destructive"
          });
          setActiveWorkout(null);
          return;
        }
        
        setWorkoutDetails(workoutData);
        loadCurrentDayExercises(workoutData, activeData.current_day);
      }
    } catch (error) {
      console.error('Error loading active workout:', error);
      toast({
        title: "Error loading workout",
        description: "There was an error loading your current workout.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentDayExercises = (workout: WorkoutDetails, dayNumber: number) => {
    const structure = workout.workout_structure;
    const dayKey = `day${dayNumber}`;
    const dayWorkout = structure[dayKey] || [];
    
    const exercises: any[] = [];
    if (Array.isArray(dayWorkout)) {
      dayWorkout.forEach((muscleGroup: any) => {
        if (muscleGroup.exercises && Array.isArray(muscleGroup.exercises)) {
          muscleGroup.exercises.forEach((exercise: any) => {
            exercises.push({
              ...exercise,
              muscleGroup: muscleGroup.muscleGroup
            });
          });
        }
      });
    }
    
    setCurrentDayExercises(exercises);
  };

  const getAllWeekExercises = () => {
    if (!workoutDetails) return [];
    
    const structure = workoutDetails.workout_structure;
    const weekExercises = [];
    
    // Only show days that actually exist in the workout structure
    const existingDays = Object.keys(structure).filter(dayKey => {
      const dayWorkout = structure[dayKey];
      return Array.isArray(dayWorkout) && dayWorkout.length > 0;
    }).sort((a, b) => {
      const dayA = parseInt(a.replace('day', ''));
      const dayB = parseInt(b.replace('day', ''));
      return dayA - dayB;
    });
    
    existingDays.forEach(dayKey => {
      const dayNumber = parseInt(dayKey.replace('day', ''));
      const dayWorkout = structure[dayKey] || [];
      const dayExercises: any[] = [];
      
      if (Array.isArray(dayWorkout) && dayWorkout.length > 0) {
        dayWorkout.forEach((muscleGroup: any) => {
          if (muscleGroup.exercises && Array.isArray(muscleGroup.exercises)) {
            muscleGroup.exercises.forEach((exercise: any) => {
              dayExercises.push({
                ...exercise,
                muscleGroup: muscleGroup.muscleGroup
              });
            });
          }
        });
      }
      
      weekExercises.push({
        day: dayNumber,
        exercises: dayExercises,
        isRestDay: false // Since we only show days with content, none are rest days
      });
    });
    
    return weekExercises;
  };

  const handleEndWorkout = async () => {
    if (!activeWorkout) return;

    try {
      const { error } = await supabase
        .from('active_workouts')
        .delete()
        .eq('id', activeWorkout.id);

      if (error) throw error;

      toast({
        title: "Mesocycle completed! 🎉",
        description: "Your mesocycle has been ended successfully. Great work!",
      });

      setActiveWorkout(null);
      setWorkoutDetails(null);
      setCurrentDayExercises([]);
    } catch (error) {
      console.error('Error ending workout:', error);
      toast({
        title: "Error ending mesocycle",
        description: "There was an error ending your mesocycle. Please try again.",
        variant: "destructive"
      });
    }
  };

  const calculateProgress = () => {
    if (!activeWorkout || !workoutDetails) return 0;
    const weekProgress = (activeWorkout.current_week - 1) / workoutDetails.duration_weeks;
    const dayProgress = (activeWorkout.current_day - 1) / workoutDetails.days_per_week;
    return Math.round((weekProgress + dayProgress / workoutDetails.duration_weeks) * 100);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your current mesocycle...</p>
        </div>
      </div>
    );
  }

  if (!activeWorkout || !workoutDetails) {
    return (
      <div className="container mx-auto px-4 py-8">
      <div className="text-center max-w-2xl mx-auto">
        <div className="mb-8">
          <CalendarDays className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-4">No Active Mesocycle</h1>
          <p className="text-lg text-muted-foreground mb-8">
            You don't have an active workout right now.
          </p>
        </div>
        
        <Button 
          size="lg" 
          onClick={() => navigate('/workouts')}
          className="px-8"
        >
          <Dumbbell className="h-5 w-5 mr-2" />
          Start a New Plan
        </Button>
      </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Current Mesocycle</h1>
          <p className="text-muted-foreground">Track your ongoing workout progress</p>
        </div>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Square className="h-4 w-4 mr-2" />
              End Mesocycle
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>End Current Mesocycle?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to end your current mesocycle? This will remove it from your active workout and you'll need to start a new plan to continue tracking.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleEndWorkout}>End Mesocycle</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            {workoutDetails.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{calculateProgress()}%</span>
          </div>
          <Progress value={calculateProgress()} className="h-2" />
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{activeWorkout.current_week}</div>
              <div className="text-sm text-muted-foreground">Current Week</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{activeWorkout.current_day}</div>
              <div className="text-sm text-muted-foreground">Current Day</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{workoutDetails.duration_weeks}</div>
              <div className="text-sm text-muted-foreground">Total Weeks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{workoutDetails.days_per_week}</div>
              <div className="text-sm text-muted-foreground">Days/Week</div>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Badge variant="secondary">{workoutDetails.program_type}</Badge>
            <Badge variant="outline">{activeWorkout.workout_type === 'custom' ? 'Custom' : 'Default'}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Current Day Workout */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Day {activeWorkout.current_day} Workout</span>
            <Button 
              onClick={() => navigate(`/workout-log/${workoutDetails.id}`)}
              size="sm"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Workout
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentDayExercises.length > 0 ? (
            <div className="space-y-3">
              {currentDayExercises.map((exercise, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <div className="font-medium">{exercise.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {exercise.muscleGroup} • {exercise.sets} sets × {exercise.reps} reps
                    </div>
                  </div>
                  <Badge variant="outline">{exercise.muscleGroup}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No exercises found for today
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Week {activeWorkout.current_week} Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {getAllWeekExercises().map((day) => (
              <div key={day.day} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Day {day.day}</h4>
                  {day.day === activeWorkout.current_day && (
                    <Badge variant="default">Current</Badge>
                  )}
                  {day.day < activeWorkout.current_day && (
                    <Badge variant="secondary">Completed</Badge>
                  )}
                </div>
                {day.isRestDay ? (
                  <div className="text-sm text-muted-foreground">
                    💤 Rest Day
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Group exercises by muscle group */}
                    {Object.entries(
                      day.exercises.reduce((acc: any, exercise: any) => {
                        if (!acc[exercise.muscleGroup]) {
                          acc[exercise.muscleGroup] = [];
                        }
                        acc[exercise.muscleGroup].push(exercise);
                        return acc;
                      }, {})
                    ).map(([muscleGroup, exercises]: [string, any[]]) => (
                      <div key={muscleGroup} className="text-sm">
                        <div className="font-medium text-primary">{muscleGroup}:</div>
                        {exercises.map((exercise, index) => (
                          <div key={index} className="text-muted-foreground ml-2">
                            • {exercise.name}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}