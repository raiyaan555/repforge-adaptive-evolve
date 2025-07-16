-- Create active_workouts table to track which workout a user is currently doing
CREATE TABLE public.active_workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workout_id UUID NOT NULL,
  workout_type TEXT NOT NULL CHECK (workout_type IN ('default', 'custom')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  current_week INTEGER NOT NULL DEFAULT 1,
  current_day INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id) -- Only one active workout per user
);

-- Enable RLS
ALTER TABLE public.active_workouts ENABLE ROW LEVEL SECURITY;

-- Create policies
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

-- Add trigger for updated_at
CREATE TRIGGER update_active_workouts_updated_at
BEFORE UPDATE ON public.active_workouts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add unit preference to profiles table
ALTER TABLE public.profiles 
ADD COLUMN unit_preference TEXT DEFAULT 'kg' CHECK (unit_preference IN ('kg', 'lbs'));

-- Create workout_calendar table to store daily workout completion data
CREATE TABLE public.workout_calendar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workout_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'missed', 'high_pump')),
  workout_summary JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, workout_date)
);

-- Enable RLS
ALTER TABLE public.workout_calendar ENABLE ROW LEVEL SECURITY;

-- Create policies
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

-- Add trigger for updated_at
CREATE TRIGGER update_workout_calendar_updated_at
BEFORE UPDATE ON public.workout_calendar
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();