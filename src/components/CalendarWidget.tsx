import { useState, useEffect } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

interface WorkoutCalendarEntry {
  workout_date: string;
  status: 'completed' | 'missed' | 'high_pump';
  workout_summary?: any;
}

interface DaySummary {
  date: Date;
  status: 'completed' | 'missed' | 'high_pump';
  exercises?: any[];
  feedback?: any;
}

export function CalendarWidget() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [workoutData, setWorkoutData] = useState<WorkoutCalendarEntry[]>([]);
  const [selectedDay, setSelectedDay] = useState<DaySummary | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadCalendarData();
    }
  }, [user]);

  const loadCalendarData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('workout_calendar')
        .select('*')
        .eq('user_id', user.id)
        .order('workout_date', { ascending: false });

      if (error) throw error;
      setWorkoutData((data || []) as WorkoutCalendarEntry[]);
    } catch (error) {
      console.error('Error loading calendar data:', error);
    }
  };

  const getDateStatus = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    const entry = workoutData.find(entry => entry.workout_date === dateString);
    return entry?.status;
  };

  const getDayClasses = (date: Date) => {
    const status = getDateStatus(date);
    const baseClasses = "relative";
    
    switch (status) {
      case 'completed':
        return `${baseClasses} after:absolute after:bottom-1 after:left-1/2 after:transform after:-translate-x-1/2 after:w-2 after:h-2 after:bg-primary after:rounded-full`;
      case 'high_pump':
        return `${baseClasses} after:absolute after:bottom-1 after:left-1/2 after:transform after:-translate-x-1/2 after:w-2 after:h-2 after:bg-orange-500 after:rounded-full`;
      case 'missed':
        return `${baseClasses} after:absolute after:bottom-1 after:left-1/2 after:transform after:-translate-x-1/2 after:w-2 after:h-2 after:bg-muted-foreground after:rounded-full`;
      default:
        return baseClasses;
    }
  };

  const handleDayClick = (selectedDate: Date) => {
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    const entry = workoutData.find(entry => entry.workout_date === dateString);
    
    if (entry) {
      setSelectedDay({
        date: selectedDate,
        status: entry.status,
        exercises: entry.workout_summary?.exercises || [],
        feedback: entry.workout_summary?.feedback || {}
      });
      setShowSummary(true);
    }
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="pointer-events-auto"
            modifiers={{
              completed: (date) => getDateStatus(date) === 'completed',
              highPump: (date) => getDateStatus(date) === 'high_pump',
              missed: (date) => getDateStatus(date) === 'missed',
            }}
            modifiersClassNames={{
              completed: "after:absolute after:bottom-1 after:left-1/2 after:transform after:-translate-x-1/2 after:w-2 after:h-2 after:bg-primary after:rounded-full",
              highPump: "after:absolute after:bottom-1 after:left-1/2 after:transform after:-translate-x-1/2 after:w-2 after:h-2 after:bg-orange-500 after:rounded-full",
              missed: "after:absolute after:bottom-1 after:left-1/2 after:transform after:-translate-x-1/2 after:w-2 after:h-2 after:bg-muted-foreground after:rounded-full",
            }}
            onDayClick={handleDayClick}
          />
          <div className="p-3 border-t">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span>Completed</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span>High Pump</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
                <span>Missed</span>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Workout Summary - {selectedDay ? format(selectedDay.date, 'PPP') : ''}
            </DialogTitle>
          </DialogHeader>
          {selectedDay && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span>Status:</span>
                <Badge 
                  variant={selectedDay.status === 'completed' ? 'default' : 'secondary'}
                  className={
                    selectedDay.status === 'high_pump' 
                      ? 'bg-orange-500 text-white' 
                      : selectedDay.status === 'missed' 
                      ? 'bg-muted-foreground text-white' 
                      : ''
                  }
                >
                  {selectedDay.status === 'high_pump' ? 'High Pump Day' : selectedDay.status}
                </Badge>
              </div>
              
              {selectedDay.exercises && selectedDay.exercises.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Exercises Completed:</h4>
                  <div className="space-y-2">
                    {selectedDay.exercises.map((exercise: any, index: number) => (
                      <div key={index} className="text-sm bg-muted p-2 rounded">
                        <div className="font-medium">{exercise.name}</div>
                        <div className="text-muted-foreground">
                          {exercise.sets} sets × {exercise.reps} reps @ {exercise.weight}kg
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedDay.feedback && (
                <div>
                  <h4 className="font-medium mb-2">Feedback:</h4>
                  <div className="text-sm space-y-1">
                    {selectedDay.feedback.pumpLevel && (
                      <div>Pump Level: <Badge variant="outline">{selectedDay.feedback.pumpLevel}</Badge></div>
                    )}
                    {selectedDay.feedback.soreness !== undefined && (
                      <div>Soreness: {selectedDay.feedback.soreness ? 'Yes' : 'No'}</div>
                    )}
                    {selectedDay.feedback.canAddSets !== undefined && (
                      <div>Can Add Sets: {selectedDay.feedback.canAddSets ? 'Yes' : 'No'}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}