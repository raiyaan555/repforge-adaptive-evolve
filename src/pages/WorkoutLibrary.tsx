import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Users, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface DefaultWorkout {
  id: string;
  name: string;
  program_type: string;
  duration_weeks: number;
  days_per_week: number;
  workout_structure: any;
}

interface CustomWorkout {
  id: string;
  name: string;
  program_type: string;
  duration_weeks: number;
  days_per_week: number;
  workout_structure: any;
  created_at: string;
}

interface WorkoutLibraryProps {
  onBack: () => void;
  onWorkoutSelected: (workout: DefaultWorkout | CustomWorkout) => void;
}

export function WorkoutLibrary({ onBack, onWorkoutSelected }: WorkoutLibraryProps) {
  const [defaultWorkouts, setDefaultWorkouts] = useState<DefaultWorkout[]>([]);
  const [customWorkouts, setCustomWorkouts] = useState<CustomWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadWorkouts();
  }, [user]);

  const loadWorkouts = async () => {
    try {
      // Load default workouts
      const { data: defaultData, error: defaultError } = await supabase
        .from('default_workouts')
        .select('*')
        .order('name');

      if (defaultError) throw defaultError;

      // Load custom workouts for user
      let customData = [];
      if (user) {
        const { data, error: customError } = await supabase
          .from('custom_workouts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (customError) throw customError;
        customData = data || [];
      }

      setDefaultWorkouts(defaultData || []);
      setCustomWorkouts(customData);
    } catch (error) {
      console.error('Error loading workouts:', error);
      toast({
        title: "Error loading workouts",
        description: "There was an error loading your workouts. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getWorkoutDays = (workoutStructure: any) => {
    if (!workoutStructure) return [];
    return Object.keys(workoutStructure).filter(day => 
      workoutStructure[day] && 
      (Array.isArray(workoutStructure[day]) ? workoutStructure[day].length > 0 : true)
    );
  };

  const WorkoutCard = ({ workout, isCustom = false }: { workout: DefaultWorkout | CustomWorkout; isCustom?: boolean }) => {
    const workoutDays = getWorkoutDays(workout.workout_structure);
    
    return (
      <Card className="cursor-pointer hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl mb-2">{workout.name}</CardTitle>
              <Badge variant="secondary" className="mb-2">
                {workout.program_type}
              </Badge>
            </div>
            {isCustom && (
              <Badge variant="outline">Custom</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{workout.duration_weeks} weeks</span>
              </div>
              <div className="flex items-center gap-1">
                <Dumbbell className="h-4 w-4" />
                <span>{workout.days_per_week} days/week</span>
              </div>
            </div>
            
            <div>
              <p className="text-sm font-medium mb-2">Workout Days:</p>
              <div className="flex flex-wrap gap-1">
                {workoutDays.map(day => (
                  <Badge key={day} variant="outline" className="text-xs capitalize">
                    {day}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="pt-3">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate(`/workout-log/${workout.id}`)}
              >
                Start This Workout
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading workouts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-4xl font-bold mb-4">Your Workouts</h1>
        <p className="text-lg text-muted-foreground">
          Choose from our expertly designed templates or use your custom plans
        </p>
      </div>

      <Tabs defaultValue="default" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="default" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Default Workouts
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4" />
            Your Custom Workouts ({customWorkouts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="default" className="mt-6">
          {defaultWorkouts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {defaultWorkouts.map((workout) => (
                <WorkoutCard key={workout.id} workout={workout} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No default workouts available</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="custom" className="mt-6">
          {customWorkouts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {customWorkouts.map((workout) => (
                <WorkoutCard key={workout.id} workout={workout} isCustom />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                You haven't created any custom workouts yet
              </p>
              <Button variant="outline" onClick={onBack}>
                Create Your First Custom Workout
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}