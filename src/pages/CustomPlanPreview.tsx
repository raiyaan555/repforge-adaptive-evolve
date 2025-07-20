import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface CustomWorkout {
  id: string;
  name: string;
  program_type: string;
  duration_weeks: number;
  days_per_week: number;
  workout_structure: any;
}

export function CustomPlanPreview() {
  const { workoutId } = useParams();
  const [workout, setWorkout] = useState<CustomWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && workoutId) {
      loadWorkout();
    }
  }, [user, workoutId]);

  const loadWorkout = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_workouts')
        .select('*')
        .eq('id', workoutId)
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setWorkout(data);
    } catch (error) {
      console.error('Error loading workout:', error);
      toast({
        title: "Error loading workout",
        description: "There was an error loading your workout. Please try again.",
        variant: "destructive"
      });
      navigate('/all-workouts');
    } finally {
      setLoading(false);
    }
  };

  const renderWorkoutStructure = () => {
    if (!workout?.workout_structure) return null;

    const days = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7', 'day8'];
    
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {days.map(dayKey => {
          const dayNumber = dayKey.replace('day', '');
          const dayWorkouts = workout.workout_structure[dayKey];
          
          return (
            <Card key={dayKey} className="h-fit">
              <CardHeader>
                <CardTitle className="text-lg">Day {dayNumber}</CardTitle>
              </CardHeader>
              <CardContent>
                {!dayWorkouts || dayWorkouts.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">💤 Rest Day</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dayWorkouts.map((workout: any, index: number) => (
                      <div key={index}>
                        <h4 className="font-medium text-primary mb-1">{workout.muscleGroup}</h4>
                        <ul className="ml-2 space-y-1">
                          {workout.exercises.map((exercise: any, exerciseIndex: number) => (
                            <li key={exerciseIndex} className="text-sm text-muted-foreground">
                              • {exercise.name.startsWith('Custom: ') ? exercise.name : exercise.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading workout preview...</p>
        </div>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-muted-foreground">Workout not found</p>
          <Button onClick={() => navigate('/all-workouts')} className="mt-4">
            Back to All Workouts
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Button variant="ghost" onClick={() => navigate('/all-workouts')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to All Workouts
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-3xl mb-2">Your Custom Plan Overview</CardTitle>
              <h2 className="text-2xl font-semibold mb-2">{workout.name}</h2>
              <Badge variant="secondary" className="mb-2">
                {workout.program_type}
              </Badge>
            </div>
            <Badge variant="outline">Custom</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{workout.duration_weeks} weeks</span>
            </div>
            <div className="flex items-center gap-1">
              <Dumbbell className="h-4 w-4" />
              <span>{workout.days_per_week} days/week</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workout Plan Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {renderWorkoutStructure()}
        </CardContent>
      </Card>
    </div>
  );
}