-- Remove all existing default workouts
DELETE FROM public.default_workouts;

-- Insert a new hypertrophy workout with the same structure as custom workouts
INSERT INTO public.default_workouts (
  name,
  program_type,
  duration_weeks,
  days_per_week,
  workout_structure
) VALUES (
  'Hypertrophy Training Program',
  'hypertrophy',
  8,
  4,
  '{
    "Day 1": [
      {
        "name": "Bench Press",
        "muscle_group": "Chest",
        "sets": 3,
        "reps": 8,
        "rest": 90
      },
      {
        "name": "Incline Dumbbell Press",
        "muscle_group": "Chest",
        "sets": 3,
        "reps": 10,
        "rest": 90
      },
      {
        "name": "Barbell Row",
        "muscle_group": "Back",
        "sets": 3,
        "reps": 8,
        "rest": 90
      },
      {
        "name": "Lat Pulldown",
        "muscle_group": "Back",
        "sets": 3,
        "reps": 10,
        "rest": 90
      }
    ],
    "Day 2": [
      {
        "name": "Squat",
        "muscle_group": "Quads",
        "sets": 3,
        "reps": 8,
        "rest": 120
      },
      {
        "name": "Romanian Deadlift",
        "muscle_group": "Hamstrings",
        "sets": 3,
        "reps": 10,
        "rest": 90
      },
      {
        "name": "Leg Press",
        "muscle_group": "Quads",
        "sets": 3,
        "reps": 12,
        "rest": 90
      },
      {
        "name": "Leg Curl",
        "muscle_group": "Hamstrings",
        "sets": 3,
        "reps": 12,
        "rest": 90
      }
    ],
    "Day 3": [
      {
        "name": "Overhead Press",
        "muscle_group": "Shoulders",
        "sets": 3,
        "reps": 8,
        "rest": 90
      },
      {
        "name": "Barbell Curl",
        "muscle_group": "Biceps",
        "sets": 3,
        "reps": 10,
        "rest": 60
      },
      {
        "name": "Close-Grip Bench Press",
        "muscle_group": "Triceps",
        "sets": 3,
        "reps": 10,
        "rest": 60
      },
      {
        "name": "Lateral Raise",
        "muscle_group": "Shoulders",
        "sets": 3,
        "reps": 12,
        "rest": 60
      }
    ],
    "Day 4": [
      {
        "name": "Deadlift",
        "muscle_group": "Back",
        "sets": 3,
        "reps": 6,
        "rest": 120
      },
      {
        "name": "Dumbbell Flyes",
        "muscle_group": "Chest",
        "sets": 3,
        "reps": 12,
        "rest": 90
      },
      {
        "name": "Calf Raise",
        "muscle_group": "Calves",
        "sets": 3,
        "reps": 15,
        "rest": 60
      },
      {
        "name": "Plank",
        "muscle_group": "Abs",
        "sets": 3,
        "reps": 30,
        "rest": 60
      }
    ]
  }'::jsonb
);