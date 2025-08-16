-- Remove the limit of 3 mesocycles by dropping the trigger and function
DROP TRIGGER IF EXISTS limit_completed_mesocycles ON public.completed_mesocycles;
DROP FUNCTION IF EXISTS public.manage_completed_mesocycles_limit();