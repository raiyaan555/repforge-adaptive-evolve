import { useState } from "react";
import { Hero } from "@/components/Hero";
import { ProgramSelector } from "@/components/ProgramSelector";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [showProgramSelector, setShowProgramSelector] = useState(false);
  const { toast } = useToast();

  const handleGetStarted = () => {
    setShowProgramSelector(true);
  };

  const handleProgramStart = (program: string, duration: number) => {
    toast({
      title: "Ready to Transform! 💪",
      description: `Your ${program} program for ${duration} weeks is ready. Connect to Supabase to save your progress and start tracking workouts.`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {!showProgramSelector ? (
        <Hero onGetStarted={handleGetStarted} />
      ) : (
        <ProgramSelector onProgramStart={handleProgramStart} />
      )}
    </div>
  );
};

export default Index;
