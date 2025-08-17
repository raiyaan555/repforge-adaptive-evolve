-- Create missing database tables for workout progression logic

-- Create default_workouts table (pre-built workout templates)
CREATE TABLE IF NOT EXISTS public.default_workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  program_type TEXT NOT NULL,
  duration_weeks INTEGER NOT NULL,
  days_per_week INTEGER NOT NULL DEFAULT 4,
  workout_structure JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create custom_workouts table (user-created workout plans)
CREATE TABLE IF NOT EXISTS public.custom_workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  program_type TEXT NOT NULL,
  duration_weeks INTEGER NOT NULL,
  days_per_week INTEGER NOT NULL,
  workout_structure JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create active_workouts table (tracks current workout progress)
CREATE TABLE IF NOT EXISTS public.active_workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workout_id UUID NOT NULL,
  workout_type TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  current_week INTEGER NOT NULL DEFAULT 1,
  current_day INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create muscle_soreness table (stores Soreness Calculation data)
CREATE TABLE IF NOT EXISTS public.muscle_soreness (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  muscle_group TEXT NOT NULL,
  soreness_level TEXT NOT NULL,
  workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  healed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pump_feedback table (stores Muscle Pump Calculation data)
CREATE TABLE IF NOT EXISTS public.pump_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  muscle_group TEXT NOT NULL,
  pump_level TEXT NOT NULL,
  workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create workout_calendar table (tracks completed workout days)
CREATE TABLE IF NOT EXISTS public.workout_calendar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workout_date DATE NOT NULL,
  status TEXT NOT NULL,
  workout_summary JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.default_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.muscle_soreness ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pump_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_calendar ENABLE ROW LEVEL SECURITY;

-- RLS Policies for default_workouts (public read access)
CREATE POLICY "Anyone can view default workouts" 
ON public.default_workouts 
FOR SELECT 
USING (true);

-- RLS Policies for custom_workouts (user-specific)
CREATE POLICY "Users can view their own custom workouts" 
ON public.custom_workouts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own custom workouts" 
ON public.custom_workouts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom workouts" 
ON public.custom_workouts 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom workouts" 
ON public.custom_workouts 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS Policies for active_workouts
CREATE POLICY "Users can view their own active workout" 
ON public.active_workouts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own active workout" 
ON public.active_workouts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own active workout" 
ON public.active_workouts 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own active workout" 
ON public.active_workouts 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS Policies for muscle_soreness
CREATE POLICY "Users can view their own muscle soreness data" 
ON public.muscle_soreness 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own muscle soreness data" 
ON public.muscle_soreness 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own muscle soreness data" 
ON public.muscle_soreness 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own muscle soreness data" 
ON public.muscle_soreness 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS Policies for pump_feedback
CREATE POLICY "Users can view their own pump feedback" 
ON public.pump_feedback 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own pump feedback" 
ON public.pump_feedback 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pump feedback" 
ON public.pump_feedback 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pump feedback" 
ON public.pump_feedback 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS Policies for workout_calendar
CREATE POLICY "Users can view their own workout calendar" 
ON public.workout_calendar 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workout calendar entries" 
ON public.workout_calendar 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workout calendar entries" 
ON public.workout_calendar 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workout calendar entries" 
ON public.workout_calendar 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_active_workouts_user_workout ON public.active_workouts(user_id, workout_id);
CREATE INDEX IF NOT EXISTS idx_muscle_soreness_user_date ON public.muscle_soreness(user_id, workout_date);
CREATE INDEX IF NOT EXISTS idx_pump_feedback_user_date ON public.pump_feedback(user_id, workout_date);
CREATE INDEX IF NOT EXISTS idx_workout_calendar_user_date ON public.workout_calendar(user_id, workout_date);
CREATE INDEX IF NOT EXISTS idx_custom_workouts_user ON public.custom_workouts(user_id);

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_custom_workouts_updated_at
  BEFORE UPDATE ON public.custom_workouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_active_workouts_updated_at
  BEFORE UPDATE ON public.active_workouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_muscle_soreness_updated_at
  BEFORE UPDATE ON public.muscle_soreness
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pump_feedback_updated_at
  BEFORE UPDATE ON public.pump_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workout_calendar_updated_at
  BEFORE UPDATE ON public.workout_calendar
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_default_workouts_updated_at
  BEFORE UPDATE ON public.default_workouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();