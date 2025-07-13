import { useState } from "react";
import { ProgramCard } from "./ProgramCard";
import { DurationSelector } from "./DurationSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const programs = [
  {
    id: "strength",
    title: "Strength",
    description: "Build raw power and muscle strength",
    features: [
      "Heavy compound movements",
      "Progressive overload focus",
      "3-4 workouts per week",
      "Strength tracking metrics"
    ],
    icon: "strength" as const,
  },
  {
    id: "hypertrophy", 
    title: "Hypertrophy",
    description: "Maximize muscle growth and size",
    features: [
      "Volume-based training",
      "Muscle group targeting",
      "4-5 workouts per week", 
      "Size measurement tracking"
    ],
    icon: "hypertrophy" as const,
  },
  {
    id: "hiit",
    title: "HIIT",
    description: "High-intensity interval training",
    features: [
      "Fat burning focus",
      "Time-efficient workouts",
      "3-4 sessions per week",
      "Cardio + strength combo"
    ],
    icon: "hiit" as const,
  },
];

interface ProgramSelectorProps {
  onProgramStart: (program: string, duration: number) => void;
}

export function ProgramSelector({ onProgramStart }: ProgramSelectorProps) {
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

      {/* Program Summary */}
      {selectedProgram && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-center">Your Program Summary</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-lg mb-6">
              You've chosen <span className="font-semibold text-primary">{programs.find(p => p.id === selectedProgram)?.title}</span> for{" "}
              <span className="font-semibold text-primary">{selectedDuration} weeks</span>.
              <br />
              Your program will adapt based on your feedback after each workout.
            </p>
            
            <Button 
              size="lg" 
              variant="energy" 
              onClick={handleStartPlan}
              className="text-lg px-12 py-4 h-auto"
            >
              Start My Plan
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}