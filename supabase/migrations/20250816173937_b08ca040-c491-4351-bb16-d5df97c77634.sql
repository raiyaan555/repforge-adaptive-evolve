-- Remove the limit of 3 mesocycles by dropping the trigger and function with CASCADE
DROP FUNCTION IF EXISTS public.manage_completed_mesocycles_limit() CASCADE;