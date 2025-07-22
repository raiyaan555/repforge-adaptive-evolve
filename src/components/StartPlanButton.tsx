import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Play } from "lucide-react";
import { BodyMeasurementsForm } from "@/components/BodyMeasurementsForm";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface StartPlanButtonProps {
  workoutId: string;
  workoutType: 'default' | 'custom';
  workoutName: string;
  disabled?: boolean;
}

export function StartPlanButton({ workoutId, workoutType, workoutName, disabled }: StartPlanButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showMeasurements, setShowMeasurements] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const handleStartPlan = async () => {
    if (!user) return;
    
    // Show body measurements form first
    setShowMeasurements(true);
  };

  const handleMeasurementsComplete = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Check if user already has an active workout
      const { data: existingActive } = await supabase
        .from('active_workouts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingActive) {
        toast({
          title: "Active workout found",
          description: "You already have an active workout. Please end it first.",
          variant: "destructive"
        });
        return;
      }

      // Create new active workout
      const { error } = await supabase
        .from('active_workouts')
        .insert({
          user_id: user.id,
          workout_id: workoutId,
          workout_type: workoutType,
          current_week: 1,
          current_day: 1
        });

      if (error) throw error;

      toast({
        title: "Plan Started! 🎉",
        description: `${workoutName} is now your active mesocycle.`
      });

      setShowMeasurements(false);
      // Navigate to current mesocycle
      navigate('/mesocycle');
    } catch (error) {
      console.error('Error starting plan:', error);
      toast({
        title: "Error",
        description: "Failed to start the plan. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkipMeasurements = async () => {
    await handleMeasurementsComplete();
  };

  return (
    <>
      <Button
        onClick={handleStartPlan}
        disabled={disabled || loading}
        className="w-full"
      >
        <Play className="h-4 w-4 mr-2" />
        {loading ? "Starting..." : "Start Plan"}
      </Button>

      <Dialog open={showMeasurements} onOpenChange={setShowMeasurements}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <BodyMeasurementsForm
            type="pre_mesocycle"
            onComplete={handleMeasurementsComplete}
            onSkip={handleSkipMeasurements}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}