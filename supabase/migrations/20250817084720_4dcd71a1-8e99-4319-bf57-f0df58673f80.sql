-- Drop existing constraints first and clean data
ALTER TABLE public.muscle_soreness DROP CONSTRAINT IF EXISTS muscle_soreness_soreness_level_check;
ALTER TABLE public.pump_feedback DROP CONSTRAINT IF EXISTS pump_feedback_pump_level_check;

-- Clean up existing data to match expected values
UPDATE muscle_soreness SET soreness_level = 'medium' WHERE soreness_level IN ('light', 'moderate'); 
UPDATE muscle_soreness SET soreness_level = 'very_sore' WHERE soreness_level = 'severe';
UPDATE pump_feedback SET pump_level = 'medium' WHERE pump_level = 'moderate';

-- Add correct constraints
ALTER TABLE public.muscle_soreness 
ADD CONSTRAINT muscle_soreness_soreness_level_check 
CHECK (soreness_level IN ('none', 'medium', 'very_sore', 'extremely_sore'));

ALTER TABLE public.pump_feedback 
ADD CONSTRAINT pump_feedback_pump_level_check 
CHECK (pump_level IN ('none', 'medium', 'amazing'));