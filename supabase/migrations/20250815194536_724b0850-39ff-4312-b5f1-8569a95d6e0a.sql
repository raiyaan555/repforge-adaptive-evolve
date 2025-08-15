-- Create completed_mesocycles table to track finished mesocycles
CREATE TABLE public.completed_mesocycles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mesocycle_name TEXT NOT NULL,
  program_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_weeks INTEGER NOT NULL,
  total_days INTEGER NOT NULL,
  mesocycle_data JSONB NOT NULL, -- Store all the workout data from the mesocycle
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.completed_mesocycles ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own completed mesocycles"
ON public.completed_mesocycles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own completed mesocycles"
ON public.completed_mesocycles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own completed mesocycles"
ON public.completed_mesocycles
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own completed mesocycles"
ON public.completed_mesocycles
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_completed_mesocycles_updated_at
BEFORE UPDATE ON public.completed_mesocycles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically manage the 3 mesocycle limit
CREATE OR REPLACE FUNCTION public.manage_completed_mesocycles_limit()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete oldest mesocycles if user has more than 3
  DELETE FROM public.completed_mesocycles 
  WHERE user_id = NEW.user_id 
  AND id NOT IN (
    SELECT id FROM public.completed_mesocycles 
    WHERE user_id = NEW.user_id 
    ORDER BY end_date DESC 
    LIMIT 3
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce the 3 mesocycle limit
CREATE TRIGGER enforce_mesocycle_limit
AFTER INSERT ON public.completed_mesocycles
FOR EACH ROW
EXECUTE FUNCTION public.manage_completed_mesocycles_limit();