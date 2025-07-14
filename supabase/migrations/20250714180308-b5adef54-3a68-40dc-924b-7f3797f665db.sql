-- Create default_workouts table for predefined workout templates
CREATE TABLE public.default_workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  program_type TEXT NOT NULL,
  duration_weeks INTEGER NOT NULL,
  days_per_week INTEGER NOT NULL DEFAULT 4,
  workout_structure JSONB NOT NULL, -- stores the complete workout plan
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create custom_workouts table for user-created workout plans
CREATE TABLE public.custom_workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  program_type TEXT NOT NULL,
  duration_weeks INTEGER NOT NULL,
  days_per_week INTEGER NOT NULL,
  workout_structure JSONB NOT NULL, -- stores the daily workout structure
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on custom_workouts
ALTER TABLE public.custom_workouts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for custom_workouts
CREATE POLICY "Users can view their own custom workouts" 
ON public.custom_workouts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own custom workouts" 
ON public.custom_workouts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom workouts" 
ON public.custom_workouts 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom workouts" 
ON public.custom_workouts 
FOR DELETE 
USING (auth.uid() = user_id);

-- Enable RLS on default_workouts (public read access)
ALTER TABLE public.default_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view default workouts" 
ON public.default_workouts 
FOR SELECT 
USING (true);

-- Add triggers for timestamp updates
CREATE TRIGGER update_default_workouts_updated_at
BEFORE UPDATE ON public.default_workouts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_custom_workouts_updated_at
BEFORE UPDATE ON public.custom_workouts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default workout templates
INSERT INTO public.default_workouts (name, program_type, duration_weeks, days_per_week, workout_structure) VALUES
('Beginner Strength', 'Strength', 6, 4, '{
  "monday": {"muscle_groups": ["Chest", "Triceps"], "exercises": [{"name": "Bench Press", "sets": 3, "reps": "8-10"}, {"name": "Push-ups", "sets": 3, "reps": "10-12"}, {"name": "Tricep Dips", "sets": 3, "reps": "8-10"}]},
  "tuesday": {"muscle_groups": ["Back", "Biceps"], "exercises": [{"name": "Pull-ups", "sets": 3, "reps": "6-8"}, {"name": "Bent-over Row", "sets": 3, "reps": "8-10"}, {"name": "Bicep Curls", "sets": 3, "reps": "10-12"}]},
  "thursday": {"muscle_groups": ["Legs"], "exercises": [{"name": "Squats", "sets": 3, "reps": "10-12"}, {"name": "Lunges", "sets": 3, "reps": "10-12"}, {"name": "Calf Raises", "sets": 3, "reps": "15-20"}]},
  "friday": {"muscle_groups": ["Shoulders", "Core"], "exercises": [{"name": "Shoulder Press", "sets": 3, "reps": "8-10"}, {"name": "Lateral Raises", "sets": 3, "reps": "10-12"}, {"name": "Plank", "sets": 3, "reps": "30-60s"}]}
}'),
('Hypertrophy Builder', 'Hypertrophy', 8, 5, '{
  "monday": {"muscle_groups": ["Chest"], "exercises": [{"name": "Bench Press", "sets": 4, "reps": "8-12"}, {"name": "Incline Dumbbell Press", "sets": 3, "reps": "10-12"}, {"name": "Chest Flyes", "sets": 3, "reps": "12-15"}]},
  "tuesday": {"muscle_groups": ["Back"], "exercises": [{"name": "Deadlifts", "sets": 4, "reps": "6-8"}, {"name": "Pull-ups", "sets": 3, "reps": "8-10"}, {"name": "Cable Rows", "sets": 3, "reps": "10-12"}]},
  "wednesday": {"muscle_groups": ["Legs"], "exercises": [{"name": "Squats", "sets": 4, "reps": "8-12"}, {"name": "Romanian Deadlifts", "sets": 3, "reps": "10-12"}, {"name": "Leg Press", "sets": 3, "reps": "12-15"}]},
  "thursday": {"muscle_groups": ["Shoulders"], "exercises": [{"name": "Shoulder Press", "sets": 4, "reps": "8-12"}, {"name": "Lateral Raises", "sets": 3, "reps": "12-15"}, {"name": "Rear Delt Flyes", "sets": 3, "reps": "12-15"}]},
  "friday": {"muscle_groups": ["Arms"], "exercises": [{"name": "Bicep Curls", "sets": 4, "reps": "10-12"}, {"name": "Tricep Extensions", "sets": 4, "reps": "10-12"}, {"name": "Hammer Curls", "sets": 3, "reps": "12-15"}]}
}'),
('HIIT Cardio', 'HIIT', 4, 4, '{
  "monday": {"muscle_groups": ["Full Body"], "exercises": [{"name": "Burpees", "sets": 4, "reps": "30s"}, {"name": "Jump Squats", "sets": 4, "reps": "30s"}, {"name": "Mountain Climbers", "sets": 4, "reps": "30s"}]},
  "tuesday": {"muscle_groups": ["Upper Body"], "exercises": [{"name": "Push-ups", "sets": 4, "reps": "45s"}, {"name": "Pike Push-ups", "sets": 4, "reps": "30s"}, {"name": "Plank to T", "sets": 4, "reps": "30s"}]},
  "thursday": {"muscle_groups": ["Lower Body"], "exercises": [{"name": "Jump Lunges", "sets": 4, "reps": "45s"}, {"name": "Single Leg Glute Bridge", "sets": 4, "reps": "30s"}, {"name": "Wall Sit", "sets": 4, "reps": "60s"}]},
  "friday": {"muscle_groups": ["Core"], "exercises": [{"name": "High Knees", "sets": 4, "reps": "45s"}, {"name": "Russian Twists", "sets": 4, "reps": "45s"}, {"name": "Dead Bug", "sets": 4, "reps": "30s"}]}
}');