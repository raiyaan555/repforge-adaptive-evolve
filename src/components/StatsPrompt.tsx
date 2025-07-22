import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Weight, Ruler } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface StatsPromptProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface CurrentStats {
  current_weight?: number;
  chest?: number;
  arms?: number;
  back?: number;
  thighs?: number;
  waist?: number;
  calves?: number;
  shoulders?: number;
}

export function StatsPrompt({ open, onClose, onComplete }: StatsPromptProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [stats, setStats] = useState<CurrentStats>({});
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [measurementUnit, setMeasurementUnit] = useState<'cm' | 'inch'>('cm');
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field: keyof CurrentStats, value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value);
    setStats(prev => ({
      ...prev,
      [field]: numValue
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    
    if (!stats.current_weight) {
      toast({
        title: "Weight required",
        description: "Please enter your current weight.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      // Insert into user_current_stats table
      const { error } = await supabase
        .from('user_current_stats')
        .insert({
          user_id: user.id,
          current_weight: stats.current_weight,
          chest: stats.chest,
          arms: stats.arms,
          back: stats.back,
          thighs: stats.thighs,
          waist: stats.waist,
          calves: stats.calves,
          shoulders: stats.shoulders,
          weight_unit: weightUnit,
          measurement_unit: measurementUnit
        });

      if (error) throw error;

      toast({
        title: "Stats saved",
        description: "Your current stats have been recorded successfully.",
      });

      onComplete();
    } catch (error) {
      console.error('Error saving stats:', error);
      toast({
        title: "Error saving stats",
        description: "There was an error saving your stats. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update Your Current Stats</DialogTitle>
        </DialogHeader>
        
        <Card>
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Weight className="h-6 w-6 text-primary" />
              </div>
            </div>
            <p className="text-muted-foreground">
              Keep your stats up to date for better tracking and insights.
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

            {/* Current Weight - Required */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Weight className="h-4 w-4" />
                Current Weight <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.1"
                  placeholder={`Enter weight in ${weightUnit}`}
                  value={stats.current_weight || ''}
                  onChange={(e) => handleInputChange('current_weight', e.target.value)}
                  className={!stats.current_weight ? 'border-destructive' : ''}
                />
                <div className="flex items-center px-3 bg-muted rounded-md text-sm text-muted-foreground">
                  {weightUnit}
                </div>
              </div>
            </div>

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
                  { key: 'thighs', label: 'Thighs' },
                  { key: 'waist', label: 'Waist' },
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
                        value={stats[key as keyof CurrentStats] || ''}
                        onChange={(e) => handleInputChange(key as keyof CurrentStats, e.target.value)}
                      />
                      <div className="flex items-center px-3 bg-muted rounded-md text-sm text-muted-foreground">
                        {measurementUnit}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                className="flex-1"
              >
                Skip for Now
              </Button>
              <Button 
                onClick={handleSave}
                disabled={loading || !stats.current_weight}
                className="flex-1"
              >
                {loading ? 'Saving...' : 'Save Stats'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}