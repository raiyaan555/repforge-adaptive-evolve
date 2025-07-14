import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const days = [
  { id: "monday", name: "Monday" },
  { id: "tuesday", name: "Tuesday" },
  { id: "wednesday", name: "Wednesday" },
  { id: "thursday", name: "Thursday" },
  { id: "friday", name: "Friday" },
  { id: "saturday", name: "Saturday" },
];

const muscleGroups = [
  "Chest", "Back", "Shoulders", "Arms", "Legs", "Core", "Glutes", "Cardio"
];

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
}

interface DayWorkout {
  muscleGroup: string;
  exercises: Exercise[];
}

interface CustomPlanBuilderProps {
  selectedProgram: string;
  selectedDuration: number;
  onBack: () => void;
  onPlanCreated: () => void;
}

export function CustomPlanBuilder({ selectedProgram, selectedDuration, onBack, onPlanCreated }: CustomPlanBuilderProps) {
  const [workoutPlan, setWorkoutPlan] = useState<Record<string, DayWorkout[]>>({});
  const [exercisesByMuscleGroup, setExercisesByMuscleGroup] = useState<Record<string, {name: string}[]>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [planName, setPlanName] = useState("");
  const [selectedDay, setSelectedDay] = useState("monday");
  const { user } = useAuth();
  const { toast } = useToast();

  // Load exercises from Supabase
  const loadExercises = async (muscleGroup: string) => {
    const { data, error } = await supabase
      .from('exercises')
      .select('name')
      .eq('muscle_group', muscleGroup);
    
    if (error) {
      console.error('Error loading exercises:', error);
      return [];
    }
    
    return data || [];
  };

  const addMuscleGroup = async (day: string) => {
    const newWorkout: DayWorkout = {
      muscleGroup: "",
      exercises: []
    };
    
    setWorkoutPlan(prev => ({
      ...prev,
      [day]: [...(prev[day] || []), newWorkout]
    }));
  };

  const updateMuscleGroup = async (day: string, index: number, muscleGroup: string) => {
    setWorkoutPlan(prev => ({
      ...prev,
      [day]: prev[day]?.map((workout, i) => 
        i === index ? { ...workout, muscleGroup } : workout
      ) || []
    }));

    // Load exercises for this muscle group if not already loaded
    if (!exercisesByMuscleGroup[muscleGroup]) {
      const exercises = await loadExercises(muscleGroup);
      setExercisesByMuscleGroup(prev => ({
        ...prev,
        [muscleGroup]: exercises
      }));
    }
  };

  const addExercise = (day: string, workoutIndex: number) => {
    const newExercise: Exercise = {
      id: crypto.randomUUID(),
      name: "",
      sets: 3,
      reps: "8-12"
    };

    setWorkoutPlan(prev => ({
      ...prev,
      [day]: prev[day]?.map((workout, i) => 
        i === workoutIndex 
          ? { ...workout, exercises: [...workout.exercises, newExercise] }
          : workout
      ) || []
    }));
  };

  const updateExercise = (day: string, workoutIndex: number, exerciseIndex: number, field: keyof Exercise, value: string | number) => {
    setWorkoutPlan(prev => ({
      ...prev,
      [day]: prev[day]?.map((workout, i) => 
        i === workoutIndex 
          ? {
              ...workout,
              exercises: workout.exercises.map((exercise, ei) =>
                ei === exerciseIndex ? { ...exercise, [field]: value } : exercise
              )
            }
          : workout
      ) || []
    }));
  };

  const removeExercise = (day: string, workoutIndex: number, exerciseIndex: number) => {
    setWorkoutPlan(prev => ({
      ...prev,
      [day]: prev[day]?.map((workout, i) => 
        i === workoutIndex 
          ? {
              ...workout,
              exercises: workout.exercises.filter((_, ei) => ei !== exerciseIndex)
            }
          : workout
      ) || []
    }));
  };

  const removeMuscleGroup = (day: string, index: number) => {
    setWorkoutPlan(prev => ({
      ...prev,
      [day]: prev[day]?.filter((_, i) => i !== index) || []
    }));
  };

  const savePlan = async () => {
    if (!planName.trim()) {
      toast({
        title: "Plan name required",
        description: "Please enter a name for your custom plan",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to save your plan",
        variant: "destructive"
      });
      return;
    }

    const daysWithWorkouts = Object.keys(workoutPlan).filter(day => 
      workoutPlan[day] && workoutPlan[day].length > 0
    );

    const { error } = await supabase
      .from('custom_workouts')
      .insert({
        user_id: user.id,
        name: planName,
        program_type: selectedProgram,
        duration_weeks: selectedDuration,
        days_per_week: daysWithWorkouts.length,
        workout_structure: workoutPlan as any
      });

    if (error) {
      toast({
        title: "Error saving plan",
        description: "There was an error saving your custom plan. Please try again.",
        variant: "destructive"
      });
      console.error('Error saving plan:', error);
      return;
    }

    toast({
      title: "Plan saved successfully! 🎉",
      description: `Your custom ${planName} plan has been created`,
    });

    setIsDialogOpen(false);
    onPlanCreated();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-4xl font-bold mb-4">Build Your Custom Plan</h1>
        <p className="text-lg text-muted-foreground">
          Create your personalized {selectedProgram} workout for {selectedDuration} weeks
        </p>
      </div>

      <Tabs value={selectedDay} onValueChange={setSelectedDay} className="w-full">
        <TabsList className="grid w-full grid-cols-6 mb-8">
          {days.map((day) => (
            <TabsTrigger key={day.id} value={day.id} className="text-sm">
              {day.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {days.map((day) => (
          <TabsContent key={day.id} value={day.id}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {day.name} Workout
                  <Button onClick={() => addMuscleGroup(day.id)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Muscle Group
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {workoutPlan[day.id]?.map((workout, workoutIndex) => (
                  <div key={workoutIndex} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 mr-4">
                        <Label>Muscle Group</Label>
                        <Select 
                          value={workout.muscleGroup} 
                          onValueChange={(value) => updateMuscleGroup(day.id, workoutIndex, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select muscle group" />
                          </SelectTrigger>
                          <SelectContent>
                            {muscleGroups.map((group) => (
                              <SelectItem key={group} value={group}>
                                {group}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => removeMuscleGroup(day.id, workoutIndex)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {workout.muscleGroup && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Exercises</Label>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => addExercise(day.id, workoutIndex)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Exercise
                          </Button>
                        </div>

                        {workout.exercises.map((exercise, exerciseIndex) => (
                          <div key={exercise.id} className="grid grid-cols-12 gap-2 items-center p-3 bg-muted rounded-lg">
                            <div className="col-span-5">
                              <Select 
                                value={exercise.name} 
                                onValueChange={(value) => updateExercise(day.id, workoutIndex, exerciseIndex, 'name', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select exercise" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(exercisesByMuscleGroup[workout.muscleGroup] || []).map((ex) => (
                                    <SelectItem key={ex.name} value={ex.name}>
                                      {ex.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-2">
                              <Input
                                type="number"
                                placeholder="Sets"
                                value={exercise.sets}
                                onChange={(e) => updateExercise(day.id, workoutIndex, exerciseIndex, 'sets', parseInt(e.target.value))}
                                min="1"
                                max="10"
                              />
                            </div>
                            <div className="col-span-3">
                              <Input
                                placeholder="Reps (e.g., 8-12)"
                                value={exercise.reps}
                                onChange={(e) => updateExercise(day.id, workoutIndex, exerciseIndex, 'reps', e.target.value)}
                              />
                            </div>
                            <div className="col-span-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => removeExercise(day.id, workoutIndex, exerciseIndex)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )) || (
                  <div className="text-center py-8 text-muted-foreground">
                    No workouts added for {day.name} yet. Click "Add Muscle Group" to get started.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <div className="mt-8 text-center">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="energy" size="lg" className="px-12">
              Choose My Workout Plan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Name Your Custom Plan</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="planName">Plan Name</Label>
                <Input
                  id="planName"
                  placeholder="e.g., My Strength Builder"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={savePlan} className="flex-1">
                  Save Plan
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}