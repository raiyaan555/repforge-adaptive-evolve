-- Clean up existing data to match expected values
-- Update muscle_soreness table
UPDATE muscle_soreness SET soreness_level = 'none' WHERE soreness_level = 'none';
UPDATE muscle_soreness SET soreness_level = 'medium' WHERE soreness_level IN ('light', 'moderate');
UPDATE muscle_soreness SET soreness_level = 'very_sore' WHERE soreness_level = 'severe';

-- Update pump_feedback table  
UPDATE pump_feedback SET pump_level = 'medium' WHERE pump_level = 'moderate';
UPDATE pump_feedback SET pump_level = 'amazing' WHERE pump_level = 'amazing';

-- Now add the correct constraints
ALTER TABLE public.muscle_soreness 
ADD CONSTRAINT muscle_soreness_soreness_level_check 
CHECK (soreness_level IN ('none', 'medium', 'very_sore', 'extremely_sore'));

ALTER TABLE public.pump_feedback 
ADD CONSTRAINT pump_feedback_pump_level_check 
CHECK (pump_level IN ('none', 'medium', 'amazing'));