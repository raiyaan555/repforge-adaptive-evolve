-- Fix check constraints for muscle_soreness and pump_feedback tables
-- The current constraints are too restrictive

-- Drop existing constraints
ALTER TABLE public.muscle_soreness DROP CONSTRAINT IF EXISTS muscle_soreness_soreness_level_check;
ALTER TABLE public.pump_feedback DROP CONSTRAINT IF EXISTS pump_feedback_pump_level_check;

-- Add correct constraints that match the actual enum values used in the code
ALTER TABLE public.muscle_soreness 
ADD CONSTRAINT muscle_soreness_soreness_level_check 
CHECK (soreness_level IN ('none', 'medium', 'very_sore', 'extremely_sore'));

ALTER TABLE public.pump_feedback 
ADD CONSTRAINT pump_feedback_pump_level_check 
CHECK (pump_level IN ('none', 'medium', 'amazing'));