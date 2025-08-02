-- Update existing muscle groups and add exercises for the new muscle groups

-- Insert new muscle group exercises for biceps
INSERT INTO public.exercises (name, muscle_group, category, description) VALUES
('Bicep Curls', 'Biceps', 'Isolation', 'Classic bicep curl with dumbbells or barbell'),
('Hammer Curls', 'Biceps', 'Isolation', 'Bicep curls with neutral grip'),
('Preacher Curls', 'Biceps', 'Isolation', 'Bicep curls using a preacher bench'),
('Cable Bicep Curls', 'Biceps', 'Isolation', 'Bicep curls using cable machine'),
('Concentration Curls', 'Biceps', 'Isolation', 'Isolated bicep curls while seated'),
('21s', 'Biceps', 'Isolation', 'Bicep curl variation with 21 reps total');

-- Insert exercises for triceps
INSERT INTO public.exercises (name, muscle_group, category, description) VALUES
('Tricep Dips', 'Triceps', 'Compound', 'Bodyweight tricep exercise using parallel bars or bench'),
('Close-Grip Bench Press', 'Triceps', 'Compound', 'Bench press with narrow grip to target triceps'),
('Tricep Pushdowns', 'Triceps', 'Isolation', 'Cable exercise targeting triceps'),
('Overhead Tricep Extension', 'Triceps', 'Isolation', 'Tricep extension with weight overhead'),
('Diamond Push-ups', 'Triceps', 'Bodyweight', 'Push-ups with hands in diamond position'),
('Skull Crushers', 'Triceps', 'Isolation', 'Lying tricep extension exercise');

-- Insert exercises for quads
INSERT INTO public.exercises (name, muscle_group, category, description) VALUES
('Squats', 'Quads', 'Compound', 'Basic squat exercise for quadriceps'),
('Leg Press', 'Quads', 'Compound', 'Machine-based leg exercise'),
('Lunges', 'Quads', 'Compound', 'Single-leg exercise for quads and glutes'),
('Leg Extensions', 'Quads', 'Isolation', 'Machine exercise isolating quadriceps'),
('Bulgarian Split Squats', 'Quads', 'Compound', 'Single-leg squat variation'),
('Front Squats', 'Quads', 'Compound', 'Squat variation emphasizing quads');

-- Insert exercises for hamstrings
INSERT INTO public.exercises (name, muscle_group, category, description) VALUES
('Romanian Deadlifts', 'Hamstrings', 'Compound', 'Hip-hinge movement targeting hamstrings'),
('Leg Curls', 'Hamstrings', 'Isolation', 'Machine exercise for hamstring isolation'),
('Stiff Leg Deadlifts', 'Hamstrings', 'Compound', 'Deadlift variation emphasizing hamstrings'),
('Good Mornings', 'Hamstrings', 'Compound', 'Hip-hinge exercise with barbell'),
('Single Leg Romanian Deadlifts', 'Hamstrings', 'Compound', 'Unilateral hamstring exercise'),
('Nordic Curls', 'Hamstrings', 'Bodyweight', 'Advanced hamstring strengthening exercise');

-- Insert exercises for calves
INSERT INTO public.exercises (name, muscle_group, category, description) VALUES
('Calf Raises', 'Calves', 'Isolation', 'Standing calf raise exercise'),
('Seated Calf Raises', 'Calves', 'Isolation', 'Seated variation of calf raises'),
('Donkey Calf Raises', 'Calves', 'Isolation', 'Bent-over calf raise variation'),
('Single Leg Calf Raises', 'Calves', 'Isolation', 'Unilateral calf strengthening'),
('Jump Rope', 'Calves', 'Cardio', 'Cardio exercise that strengthens calves'),
('Box Jumps', 'Calves', 'Plyometric', 'Explosive jumping exercise');

-- Insert exercises for glutes
INSERT INTO public.exercises (name, muscle_group, category, description) VALUES
('Hip Thrusts', 'Glutes', 'Compound', 'Primary glute strengthening exercise'),
('Glute Bridges', 'Glutes', 'Compound', 'Bodyweight glute exercise'),
('Clamshells', 'Glutes', 'Isolation', 'Glute activation exercise'),
('Fire Hydrants', 'Glutes', 'Isolation', 'Glute abduction exercise'),
('Single Leg Glute Bridges', 'Glutes', 'Compound', 'Unilateral glute bridge'),
('Curtsy Lunges', 'Glutes', 'Compound', 'Lunge variation targeting glutes');

-- Insert exercises for abs
INSERT INTO public.exercises (name, muscle_group, category, description) VALUES
('Crunches', 'Abs', 'Isolation', 'Basic abdominal crunch exercise'),
('Planks', 'Abs', 'Isometric', 'Core stability exercise'),
('Russian Twists', 'Abs', 'Isolation', 'Rotational core exercise'),
('Bicycle Crunches', 'Abs', 'Isolation', 'Dynamic crunch variation'),
('Dead Bug', 'Abs', 'Isolation', 'Core stability and control exercise'),
('Mountain Climbers', 'Abs', 'Cardio', 'Dynamic core and cardio exercise'),
('Leg Raises', 'Abs', 'Isolation', 'Lower abdominal exercise'),
('Hollow Body Hold', 'Abs', 'Isometric', 'Advanced core stability exercise');