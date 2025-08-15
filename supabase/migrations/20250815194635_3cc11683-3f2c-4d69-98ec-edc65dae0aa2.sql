-- Fix security warnings by setting search_path for functions

-- Update manage_completed_mesocycles_limit function with secure search_path
CREATE OR REPLACE FUNCTION public.manage_completed_mesocycles_limit()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
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
$$;

-- Update update_updated_at_column function with secure search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Update update_personal_record function with secure search_path
CREATE OR REPLACE FUNCTION public.update_personal_record()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
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
$$;

-- Update handle_new_user function with secure search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  RETURN NEW;
END;
$$;