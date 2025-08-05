import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

type UnitType = 'kg' | 'lbs';

interface UnitPreferenceContextType {
  unitPreference: UnitType;
  setUnitPreference: (unit: UnitType) => Promise<void>;
  convertWeight: (weight: number, fromUnit?: UnitType) => number;
  getWeightUnit: () => string;
}

const UnitPreferenceContext = createContext<UnitPreferenceContextType | undefined>(undefined);

export const useUnitPreference = () => {
  const context = useContext(UnitPreferenceContext);
  if (context === undefined) {
    throw new Error('useUnitPreference must be used within a UnitPreferenceProvider');
  }
  return context;
};

interface UnitPreferenceProviderProps {
  children: ReactNode;
}

export const UnitPreferenceProvider = ({ children }: UnitPreferenceProviderProps) => {
  const [unitPreference, setUnitPreferenceState] = useState<UnitType>('kg');
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadUnitPreference();
    }
  }, [user]);

  const loadUnitPreference = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('unit_preference')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      
      setUnitPreferenceState((data.unit_preference as UnitType) || 'kg');
    } catch (error) {
      console.error('Error loading unit preference:', error);
    }
  };

  const setUnitPreference = async (unit: UnitType) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ unit_preference: unit })
        .eq('user_id', user.id);

      if (error) throw error;
      
      setUnitPreferenceState(unit);
      toast({
        title: "Unit preference updated",
        description: `All weights will now be displayed in ${unit}.`,
      });
    } catch (error) {
      console.error('Error updating unit preference:', error);
      toast({
        title: "Error updating preferences",
        description: "There was an error updating your unit preference.",
        variant: "destructive"
      });
    }
  };

  const convertWeight = (weight: number, fromUnit?: UnitType): number => {
    const sourceUnit = fromUnit || 'kg'; // Default stored unit is kg
    
    if (sourceUnit === unitPreference) {
      return Math.round(weight * 100) / 100; // Round to 2 decimal places
    }
    
    if (sourceUnit === 'kg' && unitPreference === 'lbs') {
      return Math.round(weight * 2.20462 * 100) / 100; // kg to lbs
    }
    
    if (sourceUnit === 'lbs' && unitPreference === 'kg') {
      return Math.round(weight * 0.453592 * 100) / 100; // lbs to kg
    }
    
    return weight;
  };

  const getWeightUnit = () => unitPreference;

  const value = {
    unitPreference,
    setUnitPreference,
    convertWeight,
    getWeightUnit,
  };

  return (
    <UnitPreferenceContext.Provider value={value}>
      {children}
    </UnitPreferenceContext.Provider>
  );
};