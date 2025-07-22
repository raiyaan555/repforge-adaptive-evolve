import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PersonalRecords } from '@/components/PersonalRecords';
import { StatsPrompt } from '@/components/StatsPrompt';
import { Weight, Ruler, Calendar } from 'lucide-react';

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
  const [currentStats, setCurrentStats] = useState<CurrentStats | null>(null);
  const [showStatsPrompt, setShowStatsPrompt] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchCurrentStats();
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
                {currentStats.current_weight} {currentStats.weight_unit}
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