import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format, subDays } from "date-fns";
import { PersonalRecords } from '@/components/PersonalRecords';
import { BodyMeasurementsProgress } from '@/components/BodyMeasurementsProgress';
import { Trophy, Ruler } from 'lucide-react';

interface WeightData {
  date: string;
  weight: number;
}

interface MuscleGroupData {
  muscleGroup: string;
  sets: number;
  percentage: number;
}

interface WeeklySetsData {
  week: string;
  chest: number;
  back: number;
  shoulders: number;
  legs: number;
  arms: number;
}

const CHART_COLORS = ['#00C2FF', '#FF6F00', '#10B981', '#8B5CF6', '#F59E0B'];

export function MyStats() {
  const [unitPreference, setUnitPreference] = useState<'kg' | 'lbs'>('kg');
  const [weightProgressData, setWeightProgressData] = useState<WeightData[]>([]);
  const [weeklySetsData, setWeeklySetsData] = useState<WeeklySetsData[]>([]);
  const [muscleGroupData, setMuscleGroupData] = useState<MuscleGroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadUserPreferences();
      loadStatsData();
    }
  }, [user]);

  const loadUserPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('unit_preference')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      if (data?.unit_preference) {
        setUnitPreference(data.unit_preference as 'kg' | 'lbs');
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  };

  const updateUnitPreference = async (newUnit: 'kg' | 'lbs') => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ unit_preference: newUnit })
        .eq('user_id', user.id);

      if (error) throw error;

      setUnitPreference(newUnit);
      toast({
        title: "Preference updated",
        description: `Unit preference changed to ${newUnit.toUpperCase()}`,
      });

      // Reload weight data with new unit
      loadWeightProgressData(newUnit);
    } catch (error) {
      console.error('Error updating unit preference:', error);
      toast({
        title: "Error updating preference",
        description: "Failed to update unit preference. Please try again.",
        variant: "destructive"
      });
    }
  };

  const loadStatsData = async () => {
    await Promise.all([
      loadWeightProgressData(unitPreference),
      loadWeeklySetsData(),
      loadMuscleGroupDistribution()
    ]);
    setLoading(false);
  };

  const loadWeightProgressData = async (unit: 'kg' | 'lbs') => {
    if (!user) return;

    try {
      const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('workouts')
        .select('workout_date, weight, unit')
        .eq('user_id', user.id)
        .gte('workout_date', thirtyDaysAgo)
        .order('workout_date');

      if (error) throw error;

      // Process data to get max weight per day and convert units
      const dailyMaxWeights = new Map<string, number>();
      
      data?.forEach(workout => {
        const date = workout.workout_date;
        let weight = workout.weight;
        
        // Convert weight if needed
        if (workout.unit !== unit) {
          weight = unit === 'kg' 
            ? weight / 2.20462 // lbs to kg
            : weight * 2.20462; // kg to lbs
        }
        
        const currentMax = dailyMaxWeights.get(date) || 0;
        if (weight > currentMax) {
          dailyMaxWeights.set(date, weight);
        }
      });

      const chartData: WeightData[] = Array.from(dailyMaxWeights.entries())
        .map(([date, weight]) => ({
          date: format(new Date(date), 'MMM dd'),
          weight: Math.round(weight * 10) / 10
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setWeightProgressData(chartData);
    } catch (error) {
      console.error('Error loading weight progress:', error);
    }
  };

  const loadWeeklySetsData = async () => {
    if (!user) return;

    try {
      const fourWeeksAgo = format(subDays(new Date(), 28), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('mesocycle')
        .select('week_number, muscle_group, actual_sets')
        .eq('user_id', user.id)
        .gte('created_at', fourWeeksAgo)
        .not('actual_sets', 'is', null);

      if (error) throw error;

      // Group by week and muscle group
      const weeklyData = new Map<number, { [key: string]: number }>();
      
      data?.forEach(entry => {
        if (!weeklyData.has(entry.week_number)) {
          weeklyData.set(entry.week_number, {});
        }
        
        const week = weeklyData.get(entry.week_number)!;
        const muscleGroup = entry.muscle_group.toLowerCase();
        week[muscleGroup] = (week[muscleGroup] || 0) + (entry.actual_sets || 0);
      });

      const chartData: WeeklySetsData[] = Array.from(weeklyData.entries())
        .map(([weekNum, data]) => ({
          week: `Week ${weekNum}`,
          chest: data.chest || 0,
          back: data.back || 0,
          shoulders: data.shoulders || 0,
          legs: data.legs || 0,
          arms: data.arms || 0,
        }))
        .sort((a, b) => parseInt(a.week.split(' ')[1]) - parseInt(b.week.split(' ')[1]));

      setWeeklySetsData(chartData);
    } catch (error) {
      console.error('Error loading weekly sets data:', error);
    }
  };

  const loadMuscleGroupDistribution = async () => {
    if (!user) return;

    try {
      const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('mesocycle')
        .select('muscle_group, actual_sets')
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo)
        .not('actual_sets', 'is', null);

      if (error) throw error;

      // Group by muscle group
      const muscleGroupTotals = new Map<string, number>();
      let totalSets = 0;
      
      data?.forEach(entry => {
        const muscleGroup = entry.muscle_group;
        const sets = entry.actual_sets || 0;
        muscleGroupTotals.set(muscleGroup, (muscleGroupTotals.get(muscleGroup) || 0) + sets);
        totalSets += sets;
      });

      const chartData: MuscleGroupData[] = Array.from(muscleGroupTotals.entries())
        .map(([muscleGroup, sets]) => ({
          muscleGroup,
          sets,
          percentage: Math.round((sets / totalSets) * 100)
        }))
        .sort((a, b) => b.sets - a.sets);

      setMuscleGroupData(chartData);
    } catch (error) {
      console.error('Error loading muscle group distribution:', error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your stats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Stats</h1>
          <p className="text-muted-foreground">Track your progress and performance</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Label htmlFor="unit-toggle">kg</Label>
          <Switch
            id="unit-toggle"
            checked={unitPreference === 'lbs'}
            onCheckedChange={(checked) => updateUnitPreference(checked ? 'lbs' : 'kg')}
          />
          <Label htmlFor="unit-toggle">lbs</Label>
        </div>
      </div>

      {/* Weight Progress Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Weight Progress (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {weightProgressData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weightProgressData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs fill-muted-foreground"
                />
                <YAxis 
                  className="text-xs fill-muted-foreground"
                  label={{ value: `Weight (${unitPreference})`, angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="weight" 
                  stroke="#00C2FF" 
                  strokeWidth={3}
                  dot={{ fill: '#00C2FF', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No weight data available for the last 30 days
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Sets Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Sets by Muscle Group</CardTitle>
        </CardHeader>
        <CardContent>
          {weeklySetsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklySetsData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="week" 
                  className="text-xs fill-muted-foreground"
                />
                <YAxis 
                  className="text-xs fill-muted-foreground"
                  label={{ value: 'Sets', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Bar dataKey="chest" stackId="a" fill="#00C2FF" />
                <Bar dataKey="back" stackId="a" fill="#FF6F00" />
                <Bar dataKey="shoulders" stackId="a" fill="#10B981" />
                <Bar dataKey="legs" stackId="a" fill="#8B5CF6" />
                <Bar dataKey="arms" stackId="a" fill="#F59E0B" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No weekly sets data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Muscle Group Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Muscle Group Focus (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {muscleGroupData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={muscleGroupData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ muscleGroup, percentage }) => `${muscleGroup} (${percentage}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="sets"
                >
                  {muscleGroupData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No muscle group data available for the last 30 days
            </div>
          )}
        </CardContent>
      </Card>

      {/* Body Measurements Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5" />
            Body Measurements Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BodyMeasurementsProgress />
        </CardContent>
      </Card>

      {/* Personal Records Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Personal Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PersonalRecords />
        </CardContent>
      </Card>
    </div>
  );
}