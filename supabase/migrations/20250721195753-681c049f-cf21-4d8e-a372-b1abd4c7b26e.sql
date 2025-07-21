-- Create table for body measurements tracking
CREATE TABLE public.body_measurements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  measurement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  body_weight DECIMAL(5,2),
  chest DECIMAL(5,2),
  arms DECIMAL(5,2),
  back DECIMAL(5,2),
  waist DECIMAL(5,2),
  thighs DECIMAL(5,2),
  calves DECIMAL(5,2),
  shoulders DECIMAL(5,2),
  weight_unit TEXT DEFAULT 'kg',
  measurement_unit TEXT DEFAULT 'cm',
  measurement_type TEXT NOT NULL DEFAULT 'mid_mesocycle',
  mesocycle_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;

-- Create policies for body measurements
CREATE POLICY "Users can view their own body measurements" 
ON public.body_measurements 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own body measurements" 
ON public.body_measurements 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own body measurements" 
ON public.body_measurements 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own body measurements" 
ON public.body_measurements 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create table for personal records tracking
CREATE TABLE public.personal_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  exercise_name TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  max_weight DECIMAL(6,2) NOT NULL,
  max_reps INTEGER NOT NULL,
  weight_unit TEXT DEFAULT 'kg',
  achieved_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint to ensure one record per user per exercise
  UNIQUE(user_id, exercise_name)
);

-- Enable Row Level Security
ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;

-- Create policies for personal records
CREATE POLICY "Users can view their own personal records" 
ON public.personal_records 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own personal records" 
ON public.personal_records 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own personal records" 
ON public.personal_records 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own personal records" 
ON public.personal_records 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_body_measurements_updated_at
BEFORE UPDATE ON public.body_measurements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_personal_records_updated_at
BEFORE UPDATE ON public.personal_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically update personal records
CREATE OR REPLACE FUNCTION public.update_personal_record()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update for non-core exercises
  IF NEW.muscle_group NOT ILIKE '%core%' AND NEW.weight_used IS NOT NULL AND array_length(NEW.weight_used, 1) > 0 THEN
    -- Calculate max weight from the session
    DECLARE
      max_weight_session DECIMAL(6,2);
      max_reps_session INTEGER;
      i INTEGER;
    BEGIN
      max_weight_session := 0;
      max_reps_session := 0;
      
      -- Find the heaviest weight and corresponding reps from this session
      FOR i IN 1..array_length(NEW.weight_used, 1) LOOP
        IF NEW.weight_used[i] > max_weight_session THEN
          max_weight_session := NEW.weight_used[i];
          max_reps_session := NEW.actual_reps[i];
        ELSIF NEW.weight_used[i] = max_weight_session AND NEW.actual_reps[i] > max_reps_session THEN
          max_reps_session := NEW.actual_reps[i];
        END IF;
      END LOOP;
      
      -- Insert or update personal record
      INSERT INTO public.personal_records (
        user_id, exercise_name, muscle_group, max_weight, max_reps, weight_unit, achieved_date
      ) VALUES (
        NEW.user_id, NEW.exercise_name, NEW.muscle_group, max_weight_session, max_reps_session, NEW.weight_unit, CURRENT_DATE
      )
      ON CONFLICT (user_id, exercise_name) DO UPDATE SET
        max_weight = CASE 
          WHEN EXCLUDED.max_weight > personal_records.max_weight THEN EXCLUDED.max_weight
          WHEN EXCLUDED.max_weight = personal_records.max_weight AND EXCLUDED.max_reps > personal_records.max_reps THEN EXCLUDED.max_weight
          ELSE personal_records.max_weight
        END,
        max_reps = CASE 
          WHEN EXCLUDED.max_weight > personal_records.max_weight THEN EXCLUDED.max_reps
          WHEN EXCLUDED.max_weight = personal_records.max_weight AND EXCLUDED.max_reps > personal_records.max_reps THEN EXCLUDED.max_reps
          ELSE personal_records.max_reps
        END,
        weight_unit = EXCLUDED.weight_unit,
        achieved_date = CASE 
          WHEN EXCLUDED.max_weight > personal_records.max_weight OR 
               (EXCLUDED.max_weight = personal_records.max_weight AND EXCLUDED.max_reps > personal_records.max_reps)
          THEN EXCLUDED.achieved_date
          ELSE personal_records.achieved_date
        END,
        updated_at = now()
      WHERE EXCLUDED.max_weight > personal_records.max_weight OR 
            (EXCLUDED.max_weight = personal_records.max_weight AND EXCLUDED.max_reps > personal_records.max_reps);
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update personal records when mesocycle data is inserted/updated
CREATE TRIGGER update_personal_record_trigger
  AFTER INSERT OR UPDATE ON public.mesocycle
  FOR EACH ROW
  EXECUTE FUNCTION public.update_personal_record();