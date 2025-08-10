-- Add RPE array to mesocycle to store per-set RPE values
ALTER TABLE public.mesocycle
ADD COLUMN IF NOT EXISTS rpe numeric[];

-- Optional index to speed up lookups by user/week/day
CREATE INDEX IF NOT EXISTS idx_mesocycle_user_week_day ON public.mesocycle (user_id, week_number, day_number);
