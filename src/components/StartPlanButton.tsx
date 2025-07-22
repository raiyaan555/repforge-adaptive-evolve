import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Play } from "lucide-react";
import { BodyMeasurementsForm } from "@/components/BodyMeasurementsForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

  // Handle the initial Start Plan button click
  const handleStartPlan = async () => {
    if (!user) return;
    
    // Check if user already has an active workout first
    try {
      const { data: existingActive } = await supabase
        .from('active_workouts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingActive) {
        toast({
          title: "Active workout exists",
          description: "Please end your current mesocycle before starting a new one.",
          variant: "destructive"
        });
        return;
      }

      // Show measurements dialog
      setShowMeasurements(true);
    } catch (error) {
      console.error('Error checking active workout:', error);
      toast({
        title: "Error",
        description: "Failed to check existing workouts. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle measurements completion and actually start the plan
  const handleMeasurementsComplete = async () => {
    if (!user) return;

    setLoading(true);
    try {
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

      setShowMeasurements(false);
      
      toast({
        title: "Plan Started! 🎉",
        description: `${workoutName} is now your active mesocycle.`
      });

      navigate('/mesocycle');
    } catch (error) {
      console.error('Error starting plan:', error);
      toast({
        title: "Error starting plan",
        description: "Failed to start the plan. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle skipping measurements
  const handleSkipMeasurements = async () => {
    await handleMeasurementsComplete();
  };

  // Handle closing the dialog
  const handleCloseDialog = () => {
    setShowMeasurements(false);
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

      <Dialog open={showMeasurements} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Before Starting Your Mesocycle</DialogTitle>
          </DialogHeader>
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