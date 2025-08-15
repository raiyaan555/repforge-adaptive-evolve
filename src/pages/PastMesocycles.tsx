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
      const { data, error } = await supabase
        .from('completed_mesocycles')
        .select('*')
        .eq('user_id', user.id)
        .order('end_date', { ascending: false });

      if (error) throw error;
      setCompletedMesocycles(data || []);
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
    const workoutData = mesocycle.mesocycle_data?.workouts || [];
    const weeklyData = groupDataByWeek(workoutData);

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
              <div className="text-2xl font-bold">{workoutData.length}</div>
              <p className="text-xs text-muted-foreground">Total Exercises</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {workoutData.filter(w => w.actual_sets).length}
              </div>
              <p className="text-xs text-muted-foreground">Completed Exercises</p>
            </CardContent>
          </Card>
        </div>

        {/* Weekly Breakdown */}
        <Tabs defaultValue="week-1" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
            {Object.keys(weeklyData).map(week => (
              <TabsTrigger key={week} value={`week-${week}`} className="text-xs sm:text-sm py-2">
                Week {week}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(weeklyData).map(([weekNum, exercises]) => (
            <TabsContent key={weekNum} value={`week-${weekNum}`} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Week {weekNum} Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Day</TableHead>
                        <TableHead>Exercise</TableHead>
                        <TableHead>Muscle Group</TableHead>
                        <TableHead>Sets</TableHead>
                        <TableHead>Reps</TableHead>
                        <TableHead>Weight ({getWeightUnit()})</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exercises.map((exercise, index) => (
                        <TableRow key={index}>
                          <TableCell>Day {exercise.day_number}</TableCell>
                          <TableCell className="font-medium">{exercise.exercise_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{exercise.muscle_group}</Badge>
                          </TableCell>
                          <TableCell>
                            {exercise.actual_sets || exercise.planned_sets}
                            {exercise.actual_sets && exercise.actual_sets !== exercise.planned_sets && (
                              <span className="text-muted-foreground">
                                {' '}(planned: {exercise.planned_sets})
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {exercise.actual_reps 
                              ? exercise.actual_reps.join(', ')
                              : exercise.planned_reps
                            }
                          </TableCell>
                          <TableCell>
                            {exercise.weight_used && exercise.weight_used.length > 0
                              ? exercise.weight_used
                                  .map(weight => convertWeight(weight, exercise.weight_unit as any))
                                  .join(', ')
                              : 'Not recorded'
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
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

      <div className="text-center text-sm text-muted-foreground">
        Showing last 3 completed mesocycles
      </div>
    </div>
  );
}