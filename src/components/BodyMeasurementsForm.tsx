import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Ruler, Weight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface BodyMeasurementsFormProps {
  type: 'pre_mesocycle' | 'post_mesocycle' | 'mid_mesocycle';
  mesocycleId?: string;
  onComplete?: () => void;
  onSkip?: () => void;
  previousMeasurements?: BodyMeasurements;
}

interface BodyMeasurements {
  body_weight?: number;
  chest?: number;
  arms?: number;
  back?: number;
  waist?: number;
  thighs?: number;
  calves?: number;
  shoulders?: number;
}

export function BodyMeasurementsForm({ 
  type, 
  mesocycleId, 
  onComplete, 
  onSkip,
  previousMeasurements 
}: BodyMeasurementsFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [measurements, setMeasurements] = useState<BodyMeasurements>({
    body_weight: previousMeasurements?.body_weight || undefined,
    chest: previousMeasurements?.chest || undefined,
    arms: previousMeasurements?.arms || undefined,
    back: previousMeasurements?.back || undefined,
    waist: previousMeasurements?.waist || undefined,
    thighs: previousMeasurements?.thighs || undefined,
    calves: previousMeasurements?.calves || undefined,
    shoulders: previousMeasurements?.shoulders || undefined,
  });
  
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [measurementUnit, setMeasurementUnit] = useState<'cm' | 'inch'>('cm');
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field: keyof BodyMeasurements, value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value);
    setMeasurements(prev => ({
      ...prev,
      [field]: numValue
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    
    // Validate that at least body weight is provided for pre-mesocycle
    if (type === 'pre_mesocycle' && !measurements.body_weight) {
      toast({
        title: "Body weight required",
        description: "Please enter your current body weight to continue.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('body_measurements')
        .insert({
          user_id: user.id,
          measurement_type: type,
          mesocycle_id: mesocycleId,
          body_weight: measurements.body_weight,
          chest: measurements.chest,
          arms: measurements.arms,
          back: measurements.back,
          waist: measurements.waist,
          thighs: measurements.thighs,
          calves: measurements.calves,
          shoulders: measurements.shoulders,
          weight_unit: weightUnit,
          measurement_unit: measurementUnit
        });

      if (error) throw error;

      toast({
        title: "Measurements saved",
        description: "Your body measurements have been recorded successfully.",
      });

      onComplete?.();
    } catch (error) {
      console.error('Error saving measurements:', error);
      toast({
        title: "Error saving measurements",
        description: "There was an error saving your measurements. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'pre_mesocycle':
        return 'Before Starting Your Mesocycle';
      case 'post_mesocycle':
        return 'After Completing Your Mesocycle';
      case 'mid_mesocycle':
        return 'Current Body Measurements';
      default:
        return 'Body Measurements';
    }
  };

  const getDescription = () => {
    switch (type) {
      case 'pre_mesocycle':
        return 'Please enter your current measurements. This will help track your progress throughout the mesocycle.';
      case 'post_mesocycle':
        return 'Enter your updated measurements to see how much progress you\'ve made!';
      case 'mid_mesocycle':
        return 'Update your measurements to track your ongoing progress.';
      default:
        return 'Enter your body measurements.';
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Weight className="h-6 w-6 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl">{getTitle()}</CardTitle>
        <p className="text-muted-foreground">
          {getDescription()}
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Unit Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Weight Unit</Label>
            <Select value={weightUnit} onValueChange={(value: 'kg' | 'lbs') => setWeightUnit(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">Kilograms (kg)</SelectItem>
                <SelectItem value="lbs">Pounds (lbs)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Measurement Unit</Label>
            <Select value={measurementUnit} onValueChange={(value: 'cm' | 'inch') => setMeasurementUnit(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cm">Centimeters (cm)</SelectItem>
                <SelectItem value="inch">Inches (in)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Body Weight - Required for pre-mesocycle */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Weight className="h-4 w-4" />
            Body Weight {type === 'pre_mesocycle' && <span className="text-destructive">*</span>}
          </Label>
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.1"
              placeholder={`Enter weight in ${weightUnit}`}
              value={measurements.body_weight || ''}
              onChange={(e) => handleInputChange('body_weight', e.target.value)}
              className={type === 'pre_mesocycle' && !measurements.body_weight ? 'border-destructive' : ''}
            />
            <div className="flex items-center px-3 bg-muted rounded-md text-sm text-muted-foreground">
              {weightUnit}
            </div>
          </div>
        </div>

        <Separator />

        {/* Body Measurements - All Optional */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Ruler className="h-4 w-4" />
            <Label className="text-base font-medium">Body Measurements (Optional)</Label>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'chest', label: 'Chest' },
              { key: 'arms', label: 'Arms' },
              { key: 'back', label: 'Back' },
              { key: 'waist', label: 'Waist' },
              { key: 'thighs', label: 'Thighs' },
              { key: 'calves', label: 'Calves' },
              { key: 'shoulders', label: 'Shoulders' }
            ].map(({ key, label }) => (
              <div key={key} className="space-y-2">
                <Label className="text-sm">{label}</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder={`${label} in ${measurementUnit}`}
                    value={measurements[key as keyof BodyMeasurements] || ''}
                    onChange={(e) => handleInputChange(key as keyof BodyMeasurements, e.target.value)}
                  />
                  <div className="flex items-center px-3 bg-muted rounded-md text-sm text-muted-foreground">
                    {measurementUnit}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Progress comparison for post-mesocycle */}
        {type === 'post_mesocycle' && previousMeasurements && (
          <>
            <Separator />
            <div className="space-y-3">
              <Label className="text-base font-medium">Progress Comparison</Label>
              <div className="grid gap-2 text-sm">
                {Object.entries(measurements).map(([key, currentValue]) => {
                  const previousValue = previousMeasurements[key as keyof BodyMeasurements];
                  if (!currentValue || !previousValue) return null;
                  
                  const change = currentValue - previousValue;
                  const isPositive = change > 0;
                  const isWeight = key === 'body_weight';
                  
                  return (
                    <div key={key} className="flex justify-between items-center p-2 bg-muted rounded">
                      <span className="capitalize">{key.replace('_', ' ')}</span>
                      <span className={`font-medium ${
                        Math.abs(change) > 0.1 
                          ? isPositive ? 'text-green-600' : 'text-blue-600'
                          : 'text-muted-foreground'
                      }`}>
                        {isPositive ? '+' : ''}{change.toFixed(1)} {isWeight ? weightUnit : measurementUnit}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          {onSkip && type !== 'post_mesocycle' && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={onSkip}
              className="flex-1"
            >
              Skip for Now
            </Button>
          )}
          <Button 
            onClick={handleSave}
            disabled={loading || (type === 'pre_mesocycle' && !measurements.body_weight)}
            className="flex-1"
          >
            {loading ? 'Saving...' : 'Save Measurements'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}