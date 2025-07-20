import { useState } from "react";
import { Hero } from "@/components/Hero";
import { ProgramSelector } from "@/components/ProgramSelector";
import { CustomPlanBuilder } from "@/pages/CustomPlanBuilder";
import { WorkoutLibrary } from "@/pages/WorkoutLibrary";
import { AuthForm } from "@/components/AuthForm";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

type AppState = "hero" | "program-selector" | "custom-builder" | "workout-library" | "plan-created";

const Index = () => {
  const [appState, setAppState] = useState<AppState>("hero");
  const [selectedProgram, setSelectedProgram] = useState<string>("");
  const [selectedDuration, setSelectedDuration] = useState<number>(6);
  
  const { user, loading, signOut } = useAuth();
  const { toast } = useToast();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading RepForge...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  const handleGetStarted = () => {
    setAppState("custom-builder");
  };

  const handleProgramStart = (program: string, duration: number) => {
    setSelectedProgram(program);
    setSelectedDuration(duration);
    setAppState("custom-builder");
  };

  const handlePlanCreated = () => {
    setAppState("workout-library");
    toast({
      title: "Plan Created Successfully! 🎉",
      description: "Your personalized workout plan is ready. Time to start your transformation journey!",
    });
  };

  const handleDefaultWorkout = () => {
    setAppState("workout-library");
  };

  const handleWorkoutSelected = (workout: any) => {
    setAppState("plan-created");
    toast({
      title: "Workout Selected! 🎉",
      description: `You've selected ${workout.name}. Ready to start your fitness journey!`,
    });
  };

  const handleStartOver = () => {
    setAppState("hero");
    setSelectedProgram("");
    setSelectedDuration(6);
  };

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out successfully",
      description: "See you next time, champion!",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with user info and sign out */}
      <div className="absolute top-4 right-4 z-10">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Welcome, {user.email}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="h-8 w-8"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {appState === "hero" && (
        <Hero onGetStarted={handleGetStarted} />
      )}

      {appState === "custom-builder" && (
        <CustomPlanBuilder
          selectedProgram="Hypertrophy"
          selectedDuration={selectedDuration}
          onBack={() => setAppState("hero")}
          onPlanCreated={handlePlanCreated}
        />
      )}

      {appState === "workout-library" && (
        <WorkoutLibrary
          onBack={() => setAppState("hero")}
          onWorkoutSelected={handleWorkoutSelected}
        />
      )}

      {appState === "plan-created" && (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center max-w-2xl">
            <div className="mb-8">
              <div className="text-6xl mb-4">🎉</div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Your Plan is <span className="text-primary">Ready!</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                You've successfully created your personalized {selectedProgram} program for {selectedDuration} weeks. 
                Your journey to becoming the strongest version of yourself starts now!
              </p>
            </div>
            
            <div className="space-y-4">
              <Button
                variant="energy"
                size="lg"
                className="text-lg px-12 py-4 h-auto"
                onClick={handleStartOver}
              >
                Create Another Plan
              </Button>
              <p className="text-sm text-muted-foreground">
                Ready to start your workouts? More features coming soon!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
