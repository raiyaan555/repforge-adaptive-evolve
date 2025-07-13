-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create exercises table
CREATE TABLE public.exercises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  category TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for exercises (public read access)
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view exercises" 
ON public.exercises 
FOR SELECT 
USING (true);

-- Create plans table
CREATE TABLE public.plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  program_type TEXT NOT NULL, -- 'strength', 'hypertrophy', 'hiit'
  duration_weeks INTEGER NOT NULL,
  muscle_groups TEXT[] NOT NULL,
  exercises TEXT[] NOT NULL,
  days_per_week INTEGER DEFAULT 4,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Create policies for plans
CREATE POLICY "Users can view their own plans" 
ON public.plans 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own plans" 
ON public.plans 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own plans" 
ON public.plans 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own plans" 
ON public.plans 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create workouts table
CREATE TABLE public.workouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  sets INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  weight DECIMAL(5,2) NOT NULL,
  unit TEXT DEFAULT 'kg',
  feedback TEXT,
  workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

-- Create policies for workouts
CREATE POLICY "Users can view their own workouts" 
ON public.workouts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own workouts" 
ON public.workouts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workouts" 
ON public.workouts 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workouts" 
ON public.workouts 
FOR DELETE 
USING (auth.uid() = user_id);

-- Insert sample exercises
INSERT INTO public.exercises (name, muscle_group, category, description) VALUES
-- Chest
('Push-ups', 'Chest', 'Bodyweight', 'Basic push-up exercise'),
('Bench Press', 'Chest', 'Barbell', 'Flat barbell bench press'),
('Incline Dumbbell Press', 'Chest', 'Dumbbell', 'Incline dumbbell press'),
('Chest Flyes', 'Chest', 'Dumbbell', 'Dumbbell chest flyes'),

-- Back
('Pull-ups', 'Back', 'Bodyweight', 'Standard pull-ups'),
('Deadlifts', 'Back', 'Barbell', 'Conventional deadlifts'),
('Bent-over Rows', 'Back', 'Barbell', 'Bent-over barbell rows'),
('Lat Pulldowns', 'Back', 'Machine', 'Lat pulldown machine'),

-- Shoulders
('Overhead Press', 'Shoulders', 'Barbell', 'Standing overhead press'),
('Lateral Raises', 'Shoulders', 'Dumbbell', 'Lateral dumbbell raises'),
('Front Raises', 'Shoulders', 'Dumbbell', 'Front dumbbell raises'),
('Face Pulls', 'Shoulders', 'Cable', 'Cable face pulls'),

-- Arms
('Bicep Curls', 'Arms', 'Dumbbell', 'Basic bicep curls'),
('Tricep Dips', 'Arms', 'Bodyweight', 'Tricep dips'),
('Hammer Curls', 'Arms', 'Dumbbell', 'Hammer grip curls'),
('Close-grip Push-ups', 'Arms', 'Bodyweight', 'Close-grip push-ups'),

-- Legs
('Squats', 'Legs', 'Barbell', 'Back squats'),
('Lunges', 'Legs', 'Bodyweight', 'Forward lunges'),
('Leg Press', 'Legs', 'Machine', 'Leg press machine'),
('Calf Raises', 'Legs', 'Bodyweight', 'Standing calf raises'),

-- Core
('Planks', 'Core', 'Bodyweight', 'Standard plank hold'),
('Crunches', 'Core', 'Bodyweight', 'Basic crunches'),
('Russian Twists', 'Core', 'Bodyweight', 'Russian twist exercise'),
('Mountain Climbers', 'Core', 'Bodyweight', 'Mountain climber exercise');

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();