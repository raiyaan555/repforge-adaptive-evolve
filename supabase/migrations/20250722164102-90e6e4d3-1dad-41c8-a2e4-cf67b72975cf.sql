-- Drop the existing problematic trigger and function
DROP TRIGGER IF EXISTS update_personal_record_trigger ON public.mesocycle;
DROP FUNCTION IF EXISTS public.update_personal_record();

-- Create a simpler, more reliable function to update personal records
CREATE OR REPLACE FUNCTION public.update_personal_record()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process non-core exercises with weight data
  IF NEW.muscle_group NOT ILIKE '%core%' 
     AND NEW.weight_used IS NOT NULL 
     AND array_length(NEW.weight_used, 1) > 0 
     AND NEW.actual_reps IS NOT NULL
     AND array_length(NEW.actual_reps, 1) > 0 THEN
    
    DECLARE
      max_weight_session DECIMAL(6,2) := 0;
      max_reps_session INTEGER := 0;
      i INTEGER;
    BEGIN
      -- Find the heaviest weight and corresponding reps from this session
      FOR i IN 1..array_length(NEW.weight_used, 1) LOOP
        IF NEW.weight_used[i] > max_weight_session THEN
          max_weight_session := NEW.weight_used[i];
          max_reps_session := NEW.actual_reps[i];
        ELSIF NEW.weight_used[i] = max_weight_session AND NEW.actual_reps[i] > max_reps_session THEN
          max_reps_session := NEW.actual_reps[i];
        END IF;
      END LOOP;
      
      -- Only proceed if we have valid weight and reps
      IF max_weight_session > 0 AND max_reps_session > 0 THEN
        -- Insert or update personal record
        INSERT INTO public.personal_records (
          user_id, 
          exercise_name, 
          muscle_group, 
          max_weight, 
          max_reps, 
          weight_unit, 
          achieved_date
        ) VALUES (
          NEW.user_id, 
          NEW.exercise_name, 
          NEW.muscle_group, 
          max_weight_session, 
          max_reps_session, 
          NEW.weight_unit, 
          CURRENT_DATE
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
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER update_personal_record_trigger
  AFTER INSERT OR UPDATE ON public.mesocycle
  FOR EACH ROW
  EXECUTE FUNCTION public.update_personal_record();

-- Manually process existing mesocycle data to populate personal records
DO $$
DECLARE
  rec RECORD;
  max_weight_session DECIMAL(6,2);
  max_reps_session INTEGER;
  i INTEGER;
BEGIN
  -- Process all existing mesocycle records
  FOR rec IN 
    SELECT * FROM public.mesocycle 
    WHERE muscle_group NOT ILIKE '%core%' 
      AND weight_used IS NOT NULL 
      AND array_length(weight_used, 1) > 0
      AND actual_reps IS NOT NULL
      AND array_length(actual_reps, 1) > 0
  LOOP
    max_weight_session := 0;
    max_reps_session := 0;
    
    -- Find max weight and reps
    FOR i IN 1..array_length(rec.weight_used, 1) LOOP
      IF rec.weight_used[i] > max_weight_session THEN
        max_weight_session := rec.weight_used[i];
        max_reps_session := rec.actual_reps[i];
      ELSIF rec.weight_used[i] = max_weight_session AND rec.actual_reps[i] > max_reps_session THEN
        max_reps_session := rec.actual_reps[i];
      END IF;
    END LOOP;
    
    -- Insert or update record if valid
    IF max_weight_session > 0 AND max_reps_session > 0 THEN
      INSERT INTO public.personal_records (
        user_id, exercise_name, muscle_group, max_weight, max_reps, weight_unit, achieved_date
      ) VALUES (
        rec.user_id, rec.exercise_name, rec.muscle_group, max_weight_session, max_reps_session, rec.weight_unit, rec.created_at::date
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
    END IF;
  END LOOP;
END $$;