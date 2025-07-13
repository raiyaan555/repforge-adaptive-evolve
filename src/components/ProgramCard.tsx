import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Target, Activity } from "lucide-react";

interface ProgramCardProps {
  title: string;
  description: string;
  features: string[];
  icon: "strength" | "hypertrophy" | "hiit";
  isSelected?: boolean;
  onSelect?: () => void;
}

const iconMap = {
  strength: Target,
  hypertrophy: Zap,
  hiit: Activity,
};

export function ProgramCard({ title, description, features, icon, isSelected, onSelect }: ProgramCardProps) {
  const IconComponent = iconMap[icon];

  return (
    <Card 
      className={`relative cursor-pointer transition-all duration-300 hover:shadow-glow hover:scale-105 ${
        isSelected ? 'ring-2 ring-primary shadow-glow' : ''
      }`}
      onClick={onSelect}
    >
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <IconComponent className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-xl font-semibold">{title}</CardTitle>
        <CardDescription className="text-muted-foreground">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}