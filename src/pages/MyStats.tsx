import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PersonalRecords } from '@/components/PersonalRecords';
import { StatsPrompt } from '@/components/StatsPrompt';
import { Weight, Ruler, Calendar, TrendingUp } from 'lucide-react';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface CurrentStats {
  current_weight?: number;
  chest?: number;
  arms?: number;
  back?: number;
  thighs?: number;
  waist?: number;
  calves?: number;
  shoulders?: number;
  weight_unit?: string;
  measurement_unit?: string;
  created_at?: string;
}

export function MyStats() {
  const { user } = useAuth();
  const { convertWeight, getWeightUnit } = useUnitPreference();
  const [currentStats, setCurrentStats] = useState<CurrentStats | null>(null);
  const [showStatsPrompt, setShowStatsPrompt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [prHistory, setPrHistory] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchCurrentStats();
      fetchPRHistory();
    }
  }, [user]);

  const fetchCurrentStats = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_current_stats')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setCurrentStats(data);
    } catch (error) {
      console.error('Error fetching current stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPRHistory = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('personal_records')
        .select('*')
        .eq('user_id', user.id)
        .order('achieved_date', { ascending: true });

      if (error) throw error;
      
      // Group by exercise name and create chart data
      const groupedData = data.reduce((acc: any, record: any) => {
        if (!acc[record.exercise_name]) {
          acc[record.exercise_name] = [];
        }
        acc[record.exercise_name].push({
          date: record.achieved_date,
          weight: record.max_weight,
          reps: record.max_reps,
          exerciseName: record.exercise_name
        });
        return acc;
      }, {});

      // Convert to chart format for top exercises
      const chartData = Object.entries(groupedData)
        .slice(0, 6) // Top 6 exercises
        .map(([exercise, records]: [string, any]) => ({
          exercise,
          maxWeight: Math.max(...records.map((r: any) => r.weight)),
          records: records.length
        }));

      setPrHistory(chartData);
    } catch (error) {
      console.error('Error fetching PR history:', error);
    } finally {
      setChartLoading(false);
    }
  };

  const handleUpdateStats = () => {
    setShowStatsPrompt(true);
  };

  const handleStatsComplete = () => {
    setShowStatsPrompt(false);
    fetchCurrentStats();
  };

  const CurrentStatsDisplay = () => {
    if (loading) {
      return <div>Loading...</div>;
    }

    if (!currentStats) {
      return (
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Weight className="h-5 w-5" />
              My Current Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">No stats recorded yet</p>
            <Button onClick={handleUpdateStats}>
              Add Your Stats
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Weight className="h-5 w-5" />
            My Current Stats
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {new Date(currentStats.created_at!).toLocaleDateString()}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Weight */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Weight className="h-4 w-4 text-primary" />
                <span className="font-medium">Current Weight</span>
              </div>
              <div className="text-2xl font-bold">
                {currentStats.current_weight ? convertWeight(currentStats.current_weight, currentStats.weight_unit as any) : 0} {getWeightUnit()}
              </div>
            </div>

            {/* Body Measurements */}
            {(currentStats.chest || currentStats.arms || currentStats.back || 
              currentStats.thighs || currentStats.waist || currentStats.calves || 
              currentStats.shoulders) && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Ruler className="h-4 w-4 text-primary" />
                  <span className="font-medium">Body Measurements</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {currentStats.chest && (
                    <div>Chest: {currentStats.chest} {currentStats.measurement_unit}</div>
                  )}
                  {currentStats.arms && (
                    <div>Arms: {currentStats.arms} {currentStats.measurement_unit}</div>
                  )}
                  {currentStats.back && (
                    <div>Back: {currentStats.back} {currentStats.measurement_unit}</div>
                  )}
                  {currentStats.thighs && (
                    <div>Thighs: {currentStats.thighs} {currentStats.measurement_unit}</div>
                  )}
                  {currentStats.waist && (
                    <div>Waist: {currentStats.waist} {currentStats.measurement_unit}</div>
                  )}
                  {currentStats.calves && (
                    <div>Calves: {currentStats.calves} {currentStats.measurement_unit}</div>
                  )}
                  {currentStats.shoulders && (
                    <div>Shoulders: {currentStats.shoulders} {currentStats.measurement_unit}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <Button 
            onClick={handleUpdateStats}
            variant="outline" 
            className="w-full"
          >
            Update Stats
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">My Stats</h1>
        <p className="text-muted-foreground">
          Track your progress and personal records
        </p>
      </div>

      <Tabs defaultValue="records" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="records">Personal Records</TabsTrigger>
          <TabsTrigger value="current">My Current Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="space-y-6">
          {/* PR Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Personal Records by Exercise
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : prHistory.length > 0 ? (
                  <ChartContainer 
                    config={{
                      maxWeight: {
                        label: `Max Weight (${getWeightUnit()})`,
                        color: "hsl(var(--primary))",
                      },
                    }}
                    className="h-64"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={prHistory.map(item => ({
                        ...item,
                        maxWeight: convertWeight(item.maxWeight, 'kg')
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="exercise" 
                          tick={{ fontSize: 12 }}
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <ChartTooltip 
                          content={<ChartTooltipContent />}
                        />
                        <Bar 
                          dataKey="maxWeight" 
                          fill="hsl(var(--primary))"
                          name={`Max Weight (${getWeightUnit()})`}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No personal records to display
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  PR Count by Exercise
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : prHistory.length > 0 ? (
                  <ChartContainer 
                    config={{
                      records: {
                        label: "Records",
                        color: "hsl(var(--secondary))",
                      },
                    }}
                    className="h-64"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={prHistory}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="exercise" 
                          tick={{ fontSize: 12 }}
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <ChartTooltip 
                          content={<ChartTooltipContent />}
                        />
                        <Bar 
                          dataKey="records" 
                          fill="hsl(var(--secondary))"
                          name="Records"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No personal records to display
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          <PersonalRecords />
        </TabsContent>

        <TabsContent value="current" className="space-y-6">
          <CurrentStatsDisplay />
        </TabsContent>
      </Tabs>

      <StatsPrompt 
        open={showStatsPrompt}
        onClose={() => setShowStatsPrompt(false)}
        onComplete={handleStatsComplete}
      />
    </div>
  );
}