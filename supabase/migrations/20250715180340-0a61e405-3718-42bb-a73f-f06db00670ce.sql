-- Create mesocycle table to track workout progress
CREATE TABLE public.mesocycle (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_id UUID,
  workout_name TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  day_number INTEGER NOT NULL,
  exercise_name TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  planned_sets INTEGER NOT NULL,
  planned_reps INTEGER NOT NULL,
  actual_sets INTEGER,
  actual_reps INTEGER[],
  weight_used DECIMAL[],
  weight_unit TEXT DEFAULT 'kg',
  rir INTEGER,
  pump_level TEXT CHECK (pump_level IN ('negligible', 'low', 'moderate', 'amazing')),
  is_sore BOOLEAN,
  can_add_sets BOOLEAN,
  feedback_given BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mesocycle ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own mesocycle data" 
ON public.mesocycle 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own mesocycle data" 
ON public.mesocycle 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mesocycle data" 
ON public.mesocycle 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mesocycle data" 
ON public.mesocycle 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_mesocycle_updated_at
BEFORE UPDATE ON public.mesocycle
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();