import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface PersonalRecord {
  id: string;
  exercise_name: string;
  muscle_group: string;
  max_weight: number;
  max_reps: number;
  weight_unit: string;
  achieved_date: string;
}

export function PersonalRecords() {
  const { user } = useAuth();
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPersonalRecords();
    }
  }, [user]);

  const loadPersonalRecords = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('personal_records')
        .select('*')
        .eq('user_id', user.id)
        .order('muscle_group', { ascending: true })
        .order('max_weight', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error loading personal records:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupedRecords = records.reduce((acc, record) => {
    if (!acc[record.muscle_group]) {
      acc[record.muscle_group] = [];
    }
    acc[record.muscle_group].push(record);
    return acc;
  }, {} as Record<string, PersonalRecord[]>);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading your personal records...</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Personal Records Yet</h3>
          <p className="text-muted-foreground">
            Complete some workouts to start tracking your personal records!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedRecords).map(([muscleGroup, muscleRecords]) => (
        <Card key={muscleGroup}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              {muscleGroup} Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {muscleRecords.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">{record.exercise_name}</div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(record.achieved_date), 'MMM dd, yyyy')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg text-primary">
                      {record.max_weight} {record.weight_unit}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      × {record.max_reps} reps
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}