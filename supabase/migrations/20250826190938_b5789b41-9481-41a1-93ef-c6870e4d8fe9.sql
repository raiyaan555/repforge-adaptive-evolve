-- Add mesocycle_id columns to isolate data between training cycles
ALTER TABLE active_workouts ADD COLUMN mesocycle_id UUID DEFAULT gen_random_uuid();
ALTER TABLE mesocycle ADD COLUMN mesocycle_id UUID;
ALTER TABLE pump_feedback ADD COLUMN mesocycle_id UUID;  
ALTER TABLE muscle_soreness ADD COLUMN mesocycle_id UUID;

-- Update existing active_workouts to have a mesocycle_id
UPDATE active_workouts SET mesocycle_id = gen_random_uuid() WHERE mesocycle_id IS NULL;

-- Make mesocycle_id not null for active_workouts going forward
ALTER TABLE active_workouts ALTER COLUMN mesocycle_id SET NOT NULL;