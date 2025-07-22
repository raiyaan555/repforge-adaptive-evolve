-- Create user_current_stats table for tracking user's current physical stats
CREATE TABLE public.user_current_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  current_weight DECIMAL(6,2),
  chest DECIMAL(5,2),
  arms DECIMAL(5,2),
  back DECIMAL(5,2),
  thighs DECIMAL(5,2),
  waist DECIMAL(5,2),
  calves DECIMAL(5,2),
  shoulders DECIMAL(5,2),
  weight_unit TEXT DEFAULT 'kg',
  measurement_unit TEXT DEFAULT 'cm',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_current_stats ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own current stats" 
ON public.user_current_stats 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own current stats" 
ON public.user_current_stats 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own current stats" 
ON public.user_current_stats 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own current stats" 
ON public.user_current_stats 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_current_stats_updated_at
BEFORE UPDATE ON public.user_current_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();