import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { History, Calendar, Dumbbell, TrendingUp, Eye } from 'lucide-react';
import { format } from 'date-fns';

interface CompletedMesocycle {
  id: string;
  mesocycle_name: string;
  program_type: string;
  start_date: string;
  end_date: string;
  total_weeks: number;
  total_days: number;
  mesocycle_data: any;
  created_at: string;
}

interface WorkoutData {
  week_number: number;
  day_number: number;
  exercise_name: string;
  muscle_group: string;
  planned_sets: number;
  actual_sets?: number;
  planned_reps: number;
  actual_reps?: number[];
  weight_used?: number[];
  weight_unit?: string;
  workout_name: string;
}

export function PastMesocycles() {
  const { user } = useAuth();
  const { convertWeight, getWeightUnit } = useUnitPreference();
  const [completedMesocycles, setCompletedMesocycles] = useState<CompletedMesocycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMesocycle, setSelectedMesocycle] = useState<CompletedMesocycle | null>(null);

  useEffect(() => {
    if (user) {
      fetchCompletedMesocycles();
    }
  }, [user]);

  const fetchCompletedMesocycles = async () => {
    if (!user) return;

    try {
      // First get the completed mesocycles
      const { data: completedData, error: completedError } = await supabase
        .from('completed_mesocycles')
        .select('*')
        .eq('user_id', user.id)
        .order('end_date', { ascending: false });

      if (completedError) throw completedError;

      // For each completed mesocycle, fetch ALL the workout data from the mesocycle table
      const enhancedMesocycles = await Promise.all(
        (completedData || []).map(async (mesocycle) => {
          // Get all workouts for this mesocycle from the mesocycle table
          const { data: allWorkouts, error: workoutsError } = await supabase
            .from('mesocycle')
            .select('*')
            .eq('user_id', user.id)
            .eq('plan_id', mesocycle.id)
            .order('week_number', { ascending: true })
            .order('day_number', { ascending: true });

          if (workoutsError) {
            console.error('Error fetching workout data:', workoutsError);
            return mesocycle; // Return original if fetch fails
          }

          // If we have workout data from mesocycle table, use it; otherwise use existing data
          if (allWorkouts && allWorkouts.length > 0) {
            return {
              ...mesocycle,
              mesocycle_data: {
                workouts: allWorkouts
              }
            };
          }

          return mesocycle;
        })
      );

      setCompletedMesocycles(enhancedMesocycles);
    } catch (error) {
      console.error('Error fetching completed mesocycles:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupDataByWeek = (workoutData: WorkoutData[]) => {
    const weeks: { [key: number]: WorkoutData[] } = {};
    workoutData.forEach(workout => {
      if (!weeks[workout.week_number]) {
        weeks[workout.week_number] = [];
      }
      weeks[workout.week_number].push(workout);
    });
    return weeks;
  };

  const MesocycleDetailView = ({ mesocycle }: { mesocycle: CompletedMesocycle }) => {
    // Get all workout data and ensure we have the complete dataset
    const allWorkoutData = mesocycle.mesocycle_data?.workouts || [];
    const weeklyData = groupDataByWeek(allWorkoutData);
    
    // Group exercises by day within each week for better organization
    const groupDataByDay = (exercises: WorkoutData[]) => {
      const days: { [key: number]: WorkoutData[] } = {};
      exercises.forEach(exercise => {
        if (!days[exercise.day_number]) {
          days[exercise.day_number] = [];
        }
        days[exercise.day_number].push(exercise);
      });
      return days;
    };

    return (
      <div className="space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardContent className="pt-4 sm:pt-6">
              <div className="text-xl sm:text-2xl font-bold">{mesocycle.total_weeks}</div>
              <p className="text-xs text-muted-foreground">Total Weeks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{mesocycle.total_days}</div>
              <p className="text-xs text-muted-foreground">Training Days</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{allWorkoutData.length}</div>
              <p className="text-xs text-muted-foreground">Total Exercises</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {allWorkoutData.filter(w => w.actual_sets && w.actual_sets > 0).length}
              </div>
              <p className="text-xs text-muted-foreground">Completed Exercises</p>
            </CardContent>
          </Card>
        </div>

        {/* Complete Weekly Breakdown */}
        <Tabs defaultValue={`week-${Math.min(...Object.keys(weeklyData).map(Number))}`} className="w-full">
          <TabsList className="grid w-full h-auto" style={{ gridTemplateColumns: `repeat(${Object.keys(weeklyData).length}, 1fr)` }}>
            {Object.keys(weeklyData).sort((a, b) => Number(a) - Number(b)).map(week => (
              <TabsTrigger key={week} value={`week-${week}`} className="text-xs sm:text-sm py-2 px-1">
                Week {week}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(weeklyData).map(([weekNum, exercises]) => {
            const dailyData = groupDataByDay(exercises);
            
            return (
              <TabsContent key={weekNum} value={`week-${weekNum}`} className="space-y-4">
                <div className="space-y-4">
                  {Object.entries(dailyData)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([dayNum, dayExercises]) => (
                    <Card key={dayNum}>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Calendar className="h-4 w-4" />
                          Week {weekNum} - Day {dayNum}
                          <Badge variant="secondary" className="ml-auto">
                            {dayExercises[0]?.workout_name || 'Workout'}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="min-w-[150px]">Exercise</TableHead>
                                <TableHead className="min-w-[100px]">Muscle Group</TableHead>
                                <TableHead className="min-w-[80px]">Sets</TableHead>
                                <TableHead className="min-w-[120px]">Reps (per set)</TableHead>
                                <TableHead className="min-w-[140px]">Weight ({getWeightUnit()}) per set</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {dayExercises.map((exercise, index) => (
                                <TableRow key={index}>
                                  <TableCell className="font-medium">
                                    <div className="flex flex-col">
                                      <span>{exercise.exercise_name}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-xs">
                                      {exercise.muscle_group}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-1">
                                      <span className="font-semibold">
                                        {exercise.actual_sets || exercise.planned_sets}
                                      </span>
                                      {exercise.actual_sets && exercise.actual_sets !== exercise.planned_sets && (
                                        <span className="text-xs text-muted-foreground">
                                          (planned: {exercise.planned_sets})
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-1">
                                      {exercise.actual_reps && exercise.actual_reps.length > 0 ? (
                                        <div className="space-y-1">
                                          {exercise.actual_reps.map((reps, setIndex) => (
                                            <div key={setIndex} className="text-xs">
                                              Set {setIndex + 1}: <span className="font-semibold">{reps}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-sm">
                                          {exercise.planned_reps} (planned)
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-1">
                                      {exercise.weight_used && exercise.weight_used.length > 0 ? (
                                        <div className="space-y-1">
                                          {exercise.weight_used.map((weight, setIndex) => (
                                            <div key={setIndex} className="text-xs">
                                              Set {setIndex + 1}: <span className="font-semibold">
                                                {convertWeight(weight, exercise.weight_unit as any)} {getWeightUnit()}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-sm text-muted-foreground">
                                          Not recorded
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>

        {/* Summary by Muscle Group */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5" />
              Exercise Summary by Muscle Group
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {Object.entries(
                allWorkoutData.reduce((acc, exercise) => {
                  if (!acc[exercise.muscle_group]) {
                    acc[exercise.muscle_group] = [];
                  }
                  acc[exercise.muscle_group].push(exercise);
                  return acc;
                }, {} as { [key: string]: WorkoutData[] })
              ).map(([muscleGroup, exercises]) => (
                <div key={muscleGroup} className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Badge variant="secondary">{muscleGroup}</Badge>
                     <span className="text-sm text-muted-foreground">
                       ({(exercises as WorkoutData[]).length} exercises total)
                     </span>
                  </h4>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                     {Array.from(new Set((exercises as WorkoutData[]).map((e: WorkoutData) => e.exercise_name))).map((exerciseName: string) => {
                       const exerciseInstances = (exercises as WorkoutData[]).filter((e: WorkoutData) => e.exercise_name === exerciseName);
                       const totalSets = exerciseInstances.reduce((sum, e) => sum + (e.actual_sets || e.planned_sets), 0);
                       return (
                         <div key={exerciseName} className="flex justify-between">
                           <span>{exerciseName}</span>
                           <span className="text-muted-foreground">{totalSets} sets</span>
                         </div>
                       );
                     })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-2 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl">
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-4xl font-bold mb-2 flex items-center justify-center gap-2 sm:gap-3">
          <History className="h-6 w-6 sm:h-8 sm:w-8" />
          Past Mesocycles
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Review your completed training cycles and track your progress
        </p>
      </div>

      {completedMesocycles.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Completed Mesocycles</h3>
            <p className="text-muted-foreground">
              Complete a mesocycle to see your training history here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {completedMesocycles.map((mesocycle) => (
            <Card key={mesocycle.id}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                      <Dumbbell className="h-5 w-5 flex-shrink-0" />
                      <span className="truncate">{mesocycle.mesocycle_name}</span>
                    </CardTitle>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
                      <Badge variant="secondary" className="w-fit">{mesocycle.program_type}</Badge>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="truncate">
                          {format(new Date(mesocycle.start_date), 'MMM dd, yy')} - {' '}
                          {format(new Date(mesocycle.end_date), 'MMM dd, yy')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="flex items-center gap-2 w-full sm:w-auto"
                        size="sm"
                        onClick={() => setSelectedMesocycle(mesocycle)}
                      >
                        <Eye className="h-4 w-4" />
                        View Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[95vw] sm:max-w-6xl max-h-[90vh] overflow-y-auto mx-2">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg">
                          <TrendingUp className="h-5 w-5" />
                          <span className="truncate">{mesocycle.mesocycle_name}</span>
                        </DialogTitle>
                      </DialogHeader>
                      {selectedMesocycle && (
                        <MesocycleDetailView mesocycle={selectedMesocycle} />
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl font-bold text-primary">{mesocycle.total_weeks}</div>
                    <div className="text-muted-foreground text-xs">Weeks</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl font-bold text-primary">{mesocycle.total_days}</div>
                    <div className="text-muted-foreground text-xs">Training Days</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl font-bold text-primary">
                      {mesocycle.mesocycle_data?.workouts?.length || 0}
                    </div>
                    <div className="text-muted-foreground text-xs">Exercises</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl font-bold text-primary">
                      {mesocycle.mesocycle_data?.workouts?.filter((w: any) => w.actual_sets).length || 0}
                    </div>
                    <div className="text-muted-foreground text-xs">Completed</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

    </div>
  );
}