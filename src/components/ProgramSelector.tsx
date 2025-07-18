import { useState } from "react";
import { ProgramCard } from "./ProgramCard";
import { DurationSelector } from "./DurationSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const programs = [
  {
    id: "strength",
    title: "Strength",
    description: "",
    features: [],
    icon: "strength" as const,
  },
  {
    id: "hypertrophy", 
    title: "Hypertrophy",
    description: "",
    features: [],
    icon: "hypertrophy" as const,
  },
];

interface ProgramSelectorProps {
  onProgramStart: (program: string, duration: number) => void;
  onDefaultWorkout?: (program: string, duration: number) => void;
}

export function ProgramSelector({ onProgramStart, onDefaultWorkout }: ProgramSelectorProps) {
  const [selectedProgram, setSelectedProgram] = useState<string>("");
  const [selectedDuration, setSelectedDuration] = useState<number>(6);

  const handleStartPlan = () => {
    if (selectedProgram) {
      onProgramStart(selectedProgram, selectedDuration);
    }
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          Choose Your <span className="text-primary">Training Path</span>
        </h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Select a program that matches your goals. Don't worry - RepForge will adapt as you progress.
        </p>
      </div>

      {/* Program Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {programs.map((program) => (
          <ProgramCard
            key={program.id}
            title={program.title}
            description={program.description}
            features={program.features}
            icon={program.icon}
            isSelected={selectedProgram === program.id}
            onSelect={() => setSelectedProgram(program.id)}
          />
        ))}
      </div>

      {/* Duration Selection */}
      {selectedProgram && (
        <div className="mb-12">
          <DurationSelector
            selectedDuration={selectedDuration}
            onDurationSelect={setSelectedDuration}
          />
        </div>
      )}

      {/* Workout Creation Options */}
      {selectedProgram && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-center">Choose Your Workout Style</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-lg mb-6">
              You've chosen <span className="font-semibold text-primary">{programs.find(p => p.id === selectedProgram)?.title}</span> for{" "}
              <span className="font-semibold text-primary">{selectedDuration} weeks</span>.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary/50">
                <CardContent className="p-6 text-center">
                  <h3 className="text-xl font-semibold mb-3">Let the app choose workouts for me</h3>
                  <p className="text-muted-foreground mb-4">
                    Use our proven workout templates designed by fitness experts
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => onDefaultWorkout?.(selectedProgram, selectedDuration)}
                  >
                    Use Default Workouts
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary/50">
                <CardContent className="p-6 text-center">
                  <h3 className="text-xl font-semibold mb-3">Build my own custom plan</h3>
                  <p className="text-muted-foreground mb-4">
                    Create a personalized workout plan with your favorite exercises
                  </p>
                  <Button variant="energy" className="w-full" onClick={handleStartPlan}>
                    Build Custom Plan
                  </Button>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}