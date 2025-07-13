import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DurationSelectorProps {
  selectedDuration: number;
  onDurationSelect: (duration: number) => void;
}

const durations = [
  { weeks: 4, label: "4 Weeks", description: "Quick start program" },
  { weeks: 6, label: "6 Weeks", description: "Balanced approach" },
  { weeks: 8, label: "8 Weeks", description: "Complete transformation" },
];

export function DurationSelector({ selectedDuration, onDurationSelect }: DurationSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">Choose Your Duration</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {durations.map((duration) => (
            <Button
              key={duration.weeks}
              variant={selectedDuration === duration.weeks ? "hero" : "outline"}
              className="h-auto flex-col gap-2 p-4"
              onClick={() => onDurationSelect(duration.weeks)}
            >
              <span className="text-lg font-semibold">{duration.label}</span>
              <span className="text-sm opacity-80">{duration.description}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}