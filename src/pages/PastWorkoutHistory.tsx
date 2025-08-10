import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarWidget } from "@/components/CalendarWidget";

interface MesocycleRow {
  id: string;
  created_at: string;
  week_number: number;
  day_number: number;
  exercise_name: string;
  muscle_group: string;
  actual_sets: number | null;
  actual_reps: number[] | null;
  weight_used: number[] | null;
  rpe: number[] | null;
  pump_level: string | null; // MPC
}

interface SorenessRow {
  workout_date: string;
  muscle_group: string;
  soreness_level: string;
}

export default function PastWorkoutHistory() {
  const { user } = useAuth();
  const [rows, setRows] = useState<MesocycleRow[]>([]);
  const [soreness, setSoreness] = useState<SorenessRow[]>([]);
  const [muscleFilter, setMuscleFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    document.title = "Past Workout History | RepForge";
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data: mRows } = await supabase
        .from('mesocycle')
        .select('id, created_at, week_number, day_number, exercise_name, muscle_group, actual_sets, actual_reps, weight_used, rpe, pump_level')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);

      const { data: sRows } = await supabase
        .from('muscle_soreness')
        .select('workout_date, muscle_group, soreness_level')
        .eq('user_id', user.id)
        .order('workout_date', { ascending: false })
        .limit(200);

      setRows((mRows || []) as any);
      setSoreness((sRows || []) as any);
    };
    load();
  }, [user]);

  const muscleGroups = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => set.add(r.muscle_group));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      const d = r.created_at?.slice(0,10);
      if (muscleFilter !== 'all' && r.muscle_group !== muscleFilter) return false;
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });
  }, [rows, muscleFilter, startDate, endDate]);

  const sorenessMap = useMemo(() => {
    const map = new Map<string, string>();
    soreness.forEach(s => {
      map.set(`${s.muscle_group}|${s.workout_date}`, s.soreness_level);
    });
    return map;
  }, [soreness]);

  return (
    <main className="p-4">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Past Workout History</h1>
        <p className="text-muted-foreground">Browse your previous sessions. Filter by muscle group and date. MPC and SC are shown when available.</p>
      </header>

      <section className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <Label>Muscle Group</Label>
          <Select value={muscleFilter} onValueChange={setMuscleFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All muscle groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {muscleGroups.map(mg => (
                <SelectItem key={mg} value={mg}>{mg}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Start Date</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <Label>End Date</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </section>

      <section className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Calendar Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Reuse existing calendar widget */}
            <div className="flex items-center gap-2">
              <CalendarWidget />
              <p className="text-sm text-muted-foreground">Tip: click a day to view its summary.</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="grid gap-4">
          {filtered.map((r) => {
            const date = r.created_at?.slice(0,10);
            const sc = sorenessMap.get(`${r.muscle_group}|${date}`);
            return (
              <Card key={r.id}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <span>{date}</span>
                    <Badge variant="secondary">Week {r.week_number} · Day {r.day_number}</Badge>
                    <Badge>{r.muscle_group}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="font-medium">{r.exercise_name}</div>
                  <div className="text-muted-foreground">
                    Sets: {r.actual_sets ?? 0}
                  </div>
                  <div>Reps: {Array.isArray(r.actual_reps) ? r.actual_reps.join(', ') : '-'}</div>
                  <div>Weights: {Array.isArray(r.weight_used) ? r.weight_used.join(', ') : '-'}</div>
                  <div>RPE: {Array.isArray(r.rpe) ? r.rpe.join(', ') : '-'}</div>
                  <div className="flex gap-2 items-center">
                    <span>MPC:</span>
                    <Badge variant="outline">{r.pump_level ?? '-'}</Badge>
                    <span>SC:</span>
                    <Badge variant="outline">{sc ?? '-'}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-sm text-muted-foreground">No sessions found for the selected filters.</div>
          )}
        </div>
      </section>
    </main>
  );
}
