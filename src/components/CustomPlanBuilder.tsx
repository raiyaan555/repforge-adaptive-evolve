import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, X } from "lucide-react";

interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  category: string;
  description: string;
}

interface CustomPlanBuilderProps {
  selectedProgram: string;
  selectedDuration: number;
  onBack: () => void;
  onPlanCreated: () => void;
}

const muscleGroups = [
  "Chest",
  "Back", 
  "Shoulders",
  "Biceps",
  "Triceps",
  "Quads",
  "Hamstrings",
  "Calves",
  "Glutes",
  "Abs"
];

export function CustomPlanBuilder({ 
  selectedProgram, 
  selectedDuration, 
  onBack, 
  onPlanCreated 
}: CustomPlanBuilderProps) {
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [exercisesLoading, setExercisesLoading] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Load exercises when muscle groups change
  useEffect(() => {
    if (selectedMuscleGroups.length > 0) {
      loadExercises();
    } else {
      setExercises([]);
      setSelectedExercises([]);
    }
  }, [selectedMuscleGroups]);

  const loadExercises = async () => {
    setExercisesLoading(true);
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .in('muscle_group', selectedMuscleGroups)
        .order('muscle_group', { ascending: true });

      if (error) throw error;
      setExercises(data || []);
    } catch (error) {
      toast({
        title: "Error loading exercises",
        description: "Failed to load exercises. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExercisesLoading(false);
    }
  };

  const handleMuscleGroupToggle = (muscleGroup: string) => {
    setSelectedMuscleGroups(prev => 
      prev.includes(muscleGroup)
        ? prev.filter(mg => mg !== muscleGroup)
        : [...prev, muscleGroup]
    );
  };

  const handleExerciseToggle = (exerciseName: string) => {
    setSelectedExercises(prev =>
      prev.includes(exerciseName)
        ? prev.filter(ex => ex !== exerciseName)
        : [...prev, exerciseName]
    );
  };

  const calculateDaysPerWeek = () => {
    if (selectedProgram === 'hiit') return 3;
    if (selectedProgram === 'hypertrophy') return 5;
    return 4; // strength
  };

  const createWorkoutStructure = () => {
    const daysPerWeek = calculateDaysPerWeek();
    const structure: any = {};
    
    // Create Day 1 to Day X structure instead of weekdays
    for (let dayNum = 1; dayNum <= daysPerWeek; dayNum++) {
      const dayKey = `day${dayNum}`;
      structure[dayKey] = [];
      
      // Distribute exercises across days
      selectedMuscleGroups.forEach((muscleGroup, index) => {
        if ((index % daysPerWeek) + 1 === dayNum) {
          const muscleGroupExercises = exercises
            .filter(ex => ex.muscle_group === muscleGroup && selectedExercises.includes(ex.name))
            .slice(0, 3); // Limit to 3 exercises per muscle group per day
          
          if (muscleGroupExercises.length > 0) {
            structure[dayKey].push({
              muscleGroup,
              exercises: muscleGroupExercises.map(ex => ({
                name: ex.name,
                sets: selectedProgram === 'strength' ? 5 : selectedProgram === 'hypertrophy' ? 4 : 3,
                reps: selectedProgram === 'strength' ? 5 : selectedProgram === 'hypertrophy' ? 12 : 15,
                restTime: selectedProgram === 'strength' ? '3-5 min' : '60-90 sec'
              }))
            });
          }
        }
      });
    }
    
    return structure;
  };

  const handleCreatePlan = async () => {
    if (selectedMuscleGroups.length === 0) {
      toast({
        title: "Select muscle groups",
        description: "Please select at least one muscle group to target.",
        variant: "destructive",
      });
      return;
    }

    if (selectedExercises.length === 0) {
      toast({
        title: "Select exercises",
        description: "Please select at least one exercise for your plan.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const planName = `${selectedProgram.charAt(0).toUpperCase() + selectedProgram.slice(1)} Plan`;
      const workoutStructure = createWorkoutStructure();
      
      const { error } = await supabase
        .from('custom_workouts')
        .insert({
          user_id: user?.id,
          name: planName,
          program_type: selectedProgram,
          duration_weeks: selectedDuration,
          days_per_week: calculateDaysPerWeek(),
          workout_structure: workoutStructure,
        });

      if (error) throw error;

      toast({
        title: "Plan Created! 🎉",
        description: `Your custom ${selectedProgram} plan is ready. Time to forge your strength!`,
      });

      navigate('/workouts');
    } catch (error) {
      toast({
        title: "Error creating plan",
        description: "Failed to create your plan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exercisesByMuscleGroup = exercises.reduce((acc, exercise) => {
    if (!acc[exercise.muscle_group]) {
      acc[exercise.muscle_group] = [];
    }
    acc[exercise.muscle_group].push(exercise);
    return acc;
  }, {} as Record<string, Exercise[]>);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Program Selection
        </Button>
        
        <div className="text-center mb-8">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Build Your <span className="text-primary">Custom Plan</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Customize your {selectedProgram} program for {selectedDuration} weeks. 
            Select muscle groups and exercises that match your goals.
          </p>
        </div>
      </div>

      {/* Muscle Group Selection */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Select Muscle Groups to Target</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {muscleGroups.map((group) => (
              <div key={group} className="flex items-center space-x-2">
                <Checkbox
                  id={group}
                  checked={selectedMuscleGroups.includes(group)}
                  onCheckedChange={() => handleMuscleGroupToggle(group)}
                />
                <Label
                  htmlFor={group}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {group}
                </Label>
              </div>
            ))}
          </div>
          
          {selectedMuscleGroups.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Selected muscle groups:</p>
              <div className="flex flex-wrap gap-2">
                {selectedMuscleGroups.map((group) => (
                  <Badge key={group} variant="secondary">
                    {group}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Exercise Selection */}
      {selectedMuscleGroups.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Choose Your Exercises</CardTitle>
          </CardHeader>
          <CardContent>
            {exercisesLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading exercises...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {selectedMuscleGroups.map((muscleGroup) => (
                  <div key={muscleGroup}>
                    <h4 className="font-semibold mb-3 text-primary">{muscleGroup}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {exercisesByMuscleGroup[muscleGroup]?.map((exercise) => (
                        <div
                          key={exercise.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedExercises.includes(exercise.name)
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => handleExerciseToggle(exercise.name)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{exercise.name}</p>
                              <p className="text-sm text-muted-foreground">{exercise.category}</p>
                            </div>
                            <Checkbox
                              checked={selectedExercises.includes(exercise.name)}
                              onChange={() => {}}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plan Summary */}
      {selectedExercises.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Your Plan Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-primary">{selectedDuration}</p>
                  <p className="text-sm text-muted-foreground">Weeks</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-primary">{calculateDaysPerWeek()}</p>
                  <p className="text-sm text-muted-foreground">Days per week</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-primary">{selectedExercises.length}</p>
                  <p className="text-sm text-muted-foreground">Exercises</p>
                </div>
              </div>
              
              <div>
                <p className="font-medium mb-2">Selected Exercises:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedExercises.map((exercise) => (
                    <Badge key={exercise} variant="outline">
                      {exercise}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <Button
                onClick={handleCreatePlan}
                variant="energy"
                size="lg"
                className="w-full text-lg"
                disabled={loading}
              >
                {loading ? "Creating Your Plan..." : "Create My Custom Plan"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}