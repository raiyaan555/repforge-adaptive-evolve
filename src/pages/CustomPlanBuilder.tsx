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

const allDays = [
  { id: "day1", name: "Day 1" },
  { id: "day2", name: "Day 2" },
  { id: "day3", name: "Day 3" },
  { id: "day4", name: "Day 4" },
  { id: "day5", name: "Day 5" },
  { id: "day6", name: "Day 6" },
  { id: "day7", name: "Day 7" },
  { id: "day8", name: "Day 8" },
];

const muscleGroups = [
  "Chest", "Back", "Shoulders", "Arms", "Legs", "Core", "Glutes", "Cardio"
];

interface Exercise {
  id: string;
  name: string;
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
  const [workoutPlan, setWorkoutPlan] = useState<Record<string, DayWorkout[]>>({ day1: [] });
  const [exercisesByMuscleGroup, setExercisesByMuscleGroup] = useState<Record<string, {name: string}[]>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [planName, setPlanName] = useState("");
  const [selectedDay, setSelectedDay] = useState("day1");
  const [activeDays, setActiveDays] = useState<string[]>(["day1"]);
  const [customExercises, setCustomExercises] = useState<Record<string, string[]>>({});
  const [customExerciseDialog, setCustomExerciseDialog] = useState<{
    isOpen: boolean;
    day: string;
    workoutIndex: number;
    exerciseIndex: number;
    muscleGroup: string;
  }>({
    isOpen: false,
    day: "",
    workoutIndex: 0,
    exerciseIndex: 0,
    muscleGroup: ""
  });
  const [customExerciseName, setCustomExerciseName] = useState("");
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
    
    // Add custom exercises for this muscle group if any
    const exercises = data || [];
    const customExs = customExercises[muscleGroup] || [];
    customExs.forEach(customEx => {
      if (!exercises.find(ex => ex.name === customEx)) {
        exercises.push({ name: customEx });
      }
    });
    
    return exercises;
  };

  const addCustomExercise = (muscleGroup: string, exerciseName: string) => {
    setCustomExercises(prev => ({
      ...prev,
      [muscleGroup]: [...(prev[muscleGroup] || []), exerciseName]
    }));
    
    // Update the exercise list immediately
    setExercisesByMuscleGroup(prev => ({
      ...prev,
      [muscleGroup]: [...(prev[muscleGroup] || []), { name: exerciseName }]
    }));
  };

  const handleCustomExerciseSubmit = () => {
    if (!customExerciseName.trim() || !customExerciseDialog.muscleGroup) {
      toast({
        title: "Validation Error",
        description: "Please enter both muscle group and exercise name",
        variant: "destructive"
      });
      return;
    }

    const { day, workoutIndex, exerciseIndex, muscleGroup } = customExerciseDialog;
    
    // Add to custom exercises
    addCustomExercise(muscleGroup, customExerciseName);
    
    // Update the exercise in the workout plan
    setWorkoutPlan(prev => ({
      ...prev,
      [day]: prev[day]?.map((workout, i) => 
        i === workoutIndex 
          ? {
              ...workout,
              exercises: workout.exercises.map((exercise, ei) =>
                ei === exerciseIndex ? { ...exercise, name: customExerciseName } : exercise
              )
            }
          : workout
      ) || []
    }));

    // Reset dialog
    setCustomExerciseDialog({
      isOpen: false,
      day: "",
      workoutIndex: 0,
      exerciseIndex: 0,
      muscleGroup: ""
    });
    setCustomExerciseName("");
  };

  const addDay = () => {
    if (activeDays.length >= 8) {
      toast({
        title: "Maximum days reached",
        description: "You can only add up to 8 days in a custom plan.",
        variant: "destructive"
      });
      return;
    }

    const nextDayId = `day${activeDays.length + 1}`;
    setActiveDays(prev => [...prev, nextDayId]);
    setWorkoutPlan(prev => ({
      ...prev,
      [nextDayId]: []
    }));
    setSelectedDay(nextDayId);
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
      name: ""
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
    // Handle custom exercise input
    if (value === "__custom__") {
      setCustomExerciseDialog({
        isOpen: true,
        day,
        workoutIndex,
        exerciseIndex,
        muscleGroup: workoutPlan[day]?.[workoutIndex]?.muscleGroup || ""
      });
      return;
    }

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

    const daysWithWorkouts = activeDays.filter(day => 
      workoutPlan[day] && workoutPlan[day].length > 0
    );

    if (daysWithWorkouts.length === 0) {
      toast({
        title: "No workouts configured",
        description: "Please add at least one workout day before saving your plan.",
        variant: "destructive"
      });
      return;
    }

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
        <div className="flex items-center gap-4 mb-8">
          <TabsList className="flex-1">
            {activeDays.map((dayId) => {
              const dayInfo = allDays.find(d => d.id === dayId);
              return (
                <TabsTrigger key={dayId} value={dayId} className="text-sm">
                  {dayInfo?.name}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {activeDays.length < 8 && (
            <Button variant="outline" onClick={addDay} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Day
            </Button>
          )}
        </div>

        {activeDays.map((dayId) => {
          const dayInfo = allDays.find(d => d.id === dayId);
          if (!dayInfo) return null;
          return (
          <TabsContent key={dayId} value={dayId}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {dayInfo.name} Workout
                  <Button onClick={() => addMuscleGroup(dayId)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Muscle Group
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {workoutPlan[dayId]?.map((workout, workoutIndex) => (
                  <div key={workoutIndex} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 mr-4">
                        <Label>Muscle Group</Label>
                        <Select 
                          value={workout.muscleGroup} 
                          onValueChange={(value) => updateMuscleGroup(dayId, workoutIndex, value)}
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
                        onClick={() => removeMuscleGroup(dayId, workoutIndex)}
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
                            onClick={() => addExercise(dayId, workoutIndex)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Exercise
                          </Button>
                        </div>

                        {workout.exercises.map((exercise, exerciseIndex) => (
                          <div key={exercise.id} className="flex gap-2 items-center p-3 bg-muted rounded-lg">
                            <div className="flex-1">
                              <Select 
                                value={exercise.name} 
                                onValueChange={(value) => updateExercise(dayId, workoutIndex, exerciseIndex, 'name', value)}
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
                                  <SelectItem value="__custom__">
                                    ➕ Add Custom Exercise
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => removeExercise(dayId, workoutIndex, exerciseIndex)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )) || (
                  <div className="text-center py-8 text-muted-foreground">
                    No workouts added for {dayInfo.name} yet. Click "Add Muscle Group" to get started.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        );
        })}
      </Tabs>

      <div className="mt-8 text-center">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="energy" size="lg" className="px-12">
              Save My Workout Plan
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

      {/* Custom Exercise Dialog */}
      <Dialog open={customExerciseDialog.isOpen} onOpenChange={(open) => {
        if (!open) {
          setCustomExerciseDialog({
            isOpen: false,
            day: "",
            workoutIndex: 0,
            exerciseIndex: 0,
            muscleGroup: ""
          });
          setCustomExerciseName("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Exercise</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="muscleGroup">Muscle Group</Label>
              <Input
                id="muscleGroup"
                value={customExerciseDialog.muscleGroup}
                disabled
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="exerciseName">Exercise Name</Label>
              <Input
                id="exerciseName"
                placeholder="Enter exercise name"
                value={customExerciseName}
                onChange={(e) => setCustomExerciseName(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => {
                  setCustomExerciseDialog({
                    isOpen: false,
                    day: "",
                    workoutIndex: 0,
                    exerciseIndex: 0,
                    muscleGroup: ""
                  });
                  setCustomExerciseName("");
                }} 
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={handleCustomExerciseSubmit} className="flex-1">
                Add Exercise
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}