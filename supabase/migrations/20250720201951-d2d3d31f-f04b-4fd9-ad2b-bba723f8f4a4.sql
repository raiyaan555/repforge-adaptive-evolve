-- Create pump_feedback table to track pump feedback after muscle group completion
CREATE TABLE public.pump_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  muscle_group TEXT NOT NULL,
  pump_level TEXT NOT NULL CHECK (pump_level IN ('negligible', 'low', 'moderate', 'amazing')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create muscle_soreness table to track soreness feedback
CREATE TABLE public.muscle_soreness (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  muscle_group TEXT NOT NULL,
  soreness_level TEXT NOT NULL CHECK (soreness_level IN ('none', 'light', 'moderate', 'severe')),
  healed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.pump_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.muscle_soreness ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for pump_feedback
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

-- Create RLS policies for muscle_soreness
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

-- Add updated_at triggers
CREATE TRIGGER update_pump_feedback_updated_at
BEFORE UPDATE ON public.pump_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_muscle_soreness_updated_at
BEFORE UPDATE ON public.muscle_soreness
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();