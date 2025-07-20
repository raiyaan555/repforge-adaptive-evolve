import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DurationSelectorProps {
  selectedDuration: number;
  onDurationSelect: (duration: number) => void;
}

const durations = [
  { weeks: 4, label: "4 Weeks" },
  { weeks: 6, label: "6 Weeks" },
  { weeks: 8, label: "8 Weeks" },
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
              className="h-auto p-4"
              onClick={() => onDurationSelect(duration.weeks)}
            >
              <span className="text-lg font-semibold">{duration.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}