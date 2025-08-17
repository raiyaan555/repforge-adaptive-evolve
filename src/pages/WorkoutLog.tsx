/* ──────────────────────────────────────────────────────────────────────────
   WorkoutLog.tsx ─ REWRITE (MPC + SC LOGIC FULLY IMPLEMENTED)
   ────────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Minus, ChevronLeft } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

/* ──────────────────  TYPES  ────────────────── */
type PumpLevel = 'none' | 'medium' | 'amazing';
type Soreness = 'none' | 'medium' | 'very_sore' | 'extremely_sore';

interface Exercise { name: string; sets: number; reps: number }
interface DayStructure { muscleGroup: string; exercises: Exercise[] }
type WorkoutStructure = Record<`day${number}`, DayStructure[]>;
interface WorkoutLogRow {
  exercise: string; muscleGroup: string;
  plannedSets: number; plannedReps: number;
  actualReps: number[]; weights: number[]; rpe: number[];
  currentSets: number; completed: boolean;
}
interface MPCFeedback { pumpLevel: PumpLevel }
interface PromptState { isOpen: boolean; muscleGroup: string; rows: WorkoutLogRow[] }

/* ──────────────────  MPC / SC ADJUSTMENT TABLE  ────────────────── */
const setAdjustment = (sc: Soreness, mpc: PumpLevel): number => {
  if (sc === 'extremely_sore') return -1;

  const table: Record<Soreness, Record<PumpLevel, number>> = {
    none: { none: 3, medium: 2, amazing: 1 },
    medium: { none: 1, medium: 1, amazing: 1 },
    very_sore: { none: 0, medium: 0, amazing: 0 },
    extremely_sore: { none: -1, medium: -1, amazing: -1 }
  };
  return table[sc][mpc];
};

/* ─────────────────────────────────────────────────────────────────── */
export function WorkoutLog() {
  const { workoutId = '' } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  /* ──────────── reactive state ──────────── */
  const [workout, setWorkout] = useState<any>(null);
  const [rows, setRows] = useState<WorkoutLogRow[]>([]);
  const [week, setWeek] = useState(1);
  const [day, setDay] = useState(1);
  const [loading, setLoading] = useState(true);

  const [prompt, setPrompt] = useState<PromptState>({ isOpen: false, muscleGroup: '', rows: [] });
  const [feedback, setFeedback] = useState<MPCFeedback>({ pumpLevel: 'medium' });

  /* ──────────── ONE EFFECT TO RULE THEM ALL ──────────── */
  useEffect(() => { (async () => {
    if (!user || !workoutId) return;
    setLoading(true);

    /* 1️⃣  fetch workout (default or custom) */
    const workoutRes =
      (await supabase.from('default_workouts').select('*').eq('id', workoutId).maybeSingle()).data ??
      (await supabase.from('custom_workouts').select('*').eq('id', workoutId).eq('user_id', user.id).maybeSingle()).data;

    if (!workoutRes) return toast({ title: 'Error', description: 'Workout not found', variant: 'destructive' });

    setWorkout(workoutRes);

    /* 2️⃣  fetch active week / day */
    const active = (await supabase
      .from('active_workouts')
      .select('current_week,current_day')
      .eq('user_id', user.id)
      .eq('workout_id', workoutId)
      .maybeSingle()).data ?? { current_week: 1, current_day: 1 };

    setWeek(active.current_week); setDay(active.current_day);

    /* 3️⃣  initialize log rows with pre-fill */
    const struct: WorkoutStructure = workoutRes.workout_structure as unknown as WorkoutStructure;
    const dayKey = `day${active.current_day}` as keyof WorkoutStructure;
    const templateRows: WorkoutLogRow[] = [];

    (struct[dayKey] ?? []).forEach(block => block.exercises.forEach(ex => {
      const baseSets = ex.sets || 2;
      templateRows.push({
        exercise: ex.name, muscleGroup: block.muscleGroup,
        plannedSets: baseSets, currentSets: baseSets,
        plannedReps: ex.reps || 8,
        actualReps: Array(baseSets).fill(0),
        weights: Array(baseSets).fill(0),
        rpe: Array(baseSets).fill(7),
        completed: false
      });
    }));

    /* ----------  PREFILL (Week ≥2, Deload, SC prompt) ---------- */
    const uniqueMG = [...new Set(templateRows.map(r => r.muscleGroup))];

    /* ▸ Ask SC where needed (always week≥2, or repeat group in week1) */
    const sorenessByMG: Record<string, Soreness> = {} as any;
    if (week >= 2) {
      for (const mg of uniqueMG) sorenessByMG[mg] = await askSoreness(mg);
    } else {                                   // week 1 repeat prompt
      for (const mg of uniqueMG) {
        const { count } = await supabase
          .from('mesocycle')
          .select('id', { head: true, count: 'exact' })
          .eq('user_id', user.id)
          .eq('plan_id', workoutId)
          .eq('week_number', 1)
          .eq('muscle_group', mg);
        if (count && count > 0) sorenessByMG[mg] = await askSoreness(mg);
      }
    }

    /* ▸ Fetch previous-week rows to drive prefills */
    const prevRows = week > 1
      ? (await supabase
        .from('mesocycle')
        .select('exercise_name, muscle_group, actual_sets, actual_reps, weight_used, rpe, pump_level')
        .eq('user_id', user.id)
        .eq('plan_id', workoutId)
        .eq('week_number', week - 1)).data ?? []
      : [];

    /* ▸ Build pump lookup from prev rows */
    const pumpByMG: Record<string, PumpLevel> = {};
    for (const mg of uniqueMG) {
      const vals = prevRows.filter(r => r.muscle_group === mg).map(r => r.pump_level ?? 'medium');
      if (!vals.length) { pumpByMG[mg] = 'medium'; continue; }
      const mode = vals.sort((a, b) =>
        vals.filter(v => v === a).length - vals.filter(v => v === b).length).pop() as string;
      pumpByMG[mg] = (mode === 'none' || mode === 'negligible' || mode === 'low') ? 'none'
        : mode === 'moderate' ? 'medium' : mode as PumpLevel;
    }

    /* ▸ Apply pre-fill logic to templateRows */
    const finalRows = templateRows.map(r => {
      const prev = prevRows.find(p => p.exercise_name === r.exercise);
      const pump = pumpByMG[r.muscleGroup];
      const sc = sorenessByMG[r.muscleGroup];

      /* sets */
      let newSets = r.currentSets;
      if (week === workoutRes.duration_weeks) {          // deload last week
        newSets = Math.max(1, Math.round(newSets * 0.67));
      } else if (week >= 2 && sc) {                      // week ≥2 adaptive
        newSets = Math.max(1, newSets + setAdjustment(sc, pump));
      }
      /* reps */
      let newReps = r.plannedReps;
      if (prev && week >= 2) {
        const prevRPE = prev.rpe?.[0] ?? 9;
        if (prevRPE <= 8) newReps = (prev.actual_reps?.[0] ?? newReps) + 1;
      }
      /* weight */
      const lastWeight = prev?.weight_used?.[0] ?? 0;

      return {
        ...r,
        plannedSets: newSets, currentSets: newSets,
        plannedReps: newReps,
        weights: Array(newSets).fill(lastWeight),
        actualReps: Array(newSets).fill(0),
        rpe: Array(newSets).fill(7)
      };
    });

    setRows(finalRows);
    setLoading(false);
  })(); }, [user, workoutId]);

  /* ──────────── UI HELPERS  ──────────── */
  const mgList = [...new Set(rows.map(r => r.muscleGroup))];
  const mgRows = (mg: string) => rows.filter(r => r.muscleGroup === mg);
  const rowOK = (r: WorkoutLogRow) => r.weights.every(w => w > 0) && r.actualReps.every(x => x > 0) &&
    (week > 1 || r.rpe.every(x => x >= 1 && x <= 10));
  const doneMg = (mg: string) => mgRows(mg).every(rowOK);

  /* ──────────── Soreness Prompt (modal-less)  ──────────── */
  async function askSoreness(mg: string): Promise<Soreness> {
    return new Promise<Soreness>(resolve => {
      const levels: [Soreness, string][] = [
        ['none', 'None / Negligible'], ['medium', 'Medium'],
        ['very_sore', 'Very Sore'], ['extremely_sore', 'Extremely Sore']
      ];
      const choice = window.prompt(
        `Soreness before training ${mg}:\n` +
        levels.map((l, i) => `${i + 1}. ${l[1]}`).join('\n')
      );
      resolve(levels[Number(choice) - 1]?.[0] ?? 'medium');
    });
  }

  /* ──────────── MPC Prompt (uses Dialog) ──────────── */
  const openMPC = (mg: string) =>
    setPrompt({ isOpen: true, muscleGroup: mg, rows: mgRows(mg) });

  const saveMPC = async () => {
    const { muscleGroup, rows: mgRows } = prompt;
    await supabase.from('pump_feedback').insert({
      user_id: user.id, workout_date: new Date().toISOString().slice(0, 10),
      muscle_group: muscleGroup, pump_level: feedback.pumpLevel
    });
    // save mesocycle rows …
    for (const r of mgRows) await supabase.from('mesocycle').insert({
      user_id: user.id, plan_id: workoutId, workout_name: workout.name,
      week_number: week, day_number: day,
      exercise_name: r.exercise, muscle_group: r.muscleGroup,
      planned_sets: r.plannedSets, actual_sets: r.actualReps.length,
      planned_reps: r.plannedReps, actual_reps: r.actualReps,
      weight_used: r.weights, weight_unit: 'kg', rpe: r.rpe,
      pump_level: feedback.pumpLevel
    });
    setPrompt({ isOpen: false, muscleGroup: '', rows: [] });
    toast({ title: 'Saved', description: `Feedback saved for ${muscleGroup}` });
  };

  /* ──────────── RENDER ──────────── */
  if (loading) return <div className='p-6'>Loading…</div>;

  return (
    <div className='p-4 space-y-6 max-w-5xl mx-auto'>
      <div className='flex items-center gap-3'>
        <Button size='sm' variant='outline' onClick={() => nav('/workouts')}>
          <ChevronLeft className='w-4 h-4' />Back
        </Button>
        <h1 className='text-xl font-bold'>Day {day} • {workout.name} (Week {week})</h1>
      </div>

      {mgList.map(mg => (
        <Card key={mg}>
          <CardHeader className='flex justify-between items-center'>
            <CardTitle>{mg}</CardTitle>
            <Button size='sm' onClick={() => openMPC(mg)} disabled={!doneMg(mg)}>
              {doneMg(mg) ? 'Complete Group' : 'Fill Data First'}
            </Button>
          </CardHeader>
          <CardContent className='space-y-4'>
            {mgRows(mg).map((row, i) => (
              <ExerciseRow key={i} row={row} idx={rows.indexOf(row)} />
            ))}
          </CardContent>
        </Card>
      ))}

      {/* ──────── MPC Dialog ──────── */}
      <Dialog open={prompt.isOpen} onOpenChange={() => setPrompt(s => ({ ...s, isOpen: false }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>MPC for {prompt.muscleGroup}</DialogTitle></DialogHeader>
          <RadioGroup value={feedback.pumpLevel} onValueChange={v => setFeedback({ pumpLevel: v as PumpLevel })}>
            {(['none', 'medium', 'amazing'] as PumpLevel[]).map(l => (
              <div key={l} className='flex items-center gap-2'>
                <RadioGroupItem value={l} id={`pump-${l}`} />
                <Label htmlFor={`pump-${l}`}>{l === 'none' ? 'None / Negligible' : l === 'medium' ? 'Medium' : 'Amazing'}</Label>
              </div>
            ))}
          </RadioGroup>
          <Button className='w-full mt-4' onClick={saveMPC}>Save Feedback</Button>
        </DialogContent>
      </Dialog>
    </div>
  );

  /* ──────────── INNER EXERCISE COMPONENT ──────────── */
  function ExerciseRow({ row, idx }: { row: WorkoutLogRow, idx: number }) {
    const update = (set: number, field: 'weight' | 'reps' | 'rpe', val: number) => {
      setRows(rs => {
        const copy = [...rs]; const r = { ...copy[idx] };
        const arr = field === 'weight' ? r.weights : field === 'reps' ? r.actualReps : r.rpe;
        arr[set] = val; r.completed = rowOK(r); copy[idx] = r; return copy;
      });
    };
    const addSet = () => setRows(rs => {
      const copy = [...rs]; const r = { ...copy[idx] };
      r.currentSets++; r.plannedSets++; r.actualReps.push(0); r.weights.push(0); r.rpe.push(7);
      copy[idx] = r; return copy;
    });
    const removeSet = () => setRows(rs => {
      const copy = [...rs]; const r = { ...copy[idx] };
      if (r.currentSets > 1) {
        r.currentSets--; r.plannedSets--;
        r.actualReps.pop(); r.weights.pop(); r.rpe.pop();
      }
      copy[idx] = r; return copy;
    });

    return (
      <div className='border rounded p-3 space-y-2'>
        <div className='flex justify-between items-center'>
          <span className='font-semibold'>{row.exercise}</span>
          <span className='text-sm text-muted-foreground'>Sets: {row.currentSets}</span>
        </div>

        {row.weights.map((_, sIndex) => (
          <div key={sIndex} className='grid grid-cols-3 gap-2'>
            <Input placeholder='Wt' type='number'
              value={row.weights[sIndex] || ''}
              onChange={e => update(sIndex, 'weight', Number(e.target.value) || 0)} />
            <Input placeholder='Reps' type='number'
              value={row.actualReps[sIndex] || ''}
              onChange={e => update(sIndex, 'reps', Number(e.target.value) || 0)} />
            {week === 1 && (
              <Input placeholder='RPE' type='number'
                value={row.rpe[sIndex] || ''}
                onChange={e => update(sIndex, 'rpe', Number(e.target.value) || 0)} />
            )}
          </div>
        ))}

        <div className='flex gap-2 mt-2'>
          <Button size='sm' variant='outline' onClick={addSet}><Plus className='w-3 h-3' />Add</Button>
          {row.currentSets > 1 && <Button size='sm' variant='outline' onClick={removeSet}><Minus className='w-3 h-3' />Remove</Button>}
        </div>
      </div>
    );
  }
}