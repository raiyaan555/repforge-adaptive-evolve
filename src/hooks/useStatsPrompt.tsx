import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useStatsPrompt() {
  const { user } = useAuth();
  const [shouldShowPrompt, setShouldShowPrompt] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      checkStatsStatus();
    } else {
      setLoading(false);
    }
  }, [user]);

  const checkStatsStatus = async () => {
    if (!user) return;

    try {
      // Check if user has any current stats
      const { data: currentStats, error } = await supabase
        .from('user_current_stats')
        .select('created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!currentStats) {
        // No stats at all - show prompt
        setShouldShowPrompt(true);
      } else {
        // Check if stats are older than 30 days
        const statsDate = new Date(currentStats.created_at);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        if (statsDate < thirtyDaysAgo) {
          setShouldShowPrompt(true);
        }
      }
    } catch (error) {
      console.error('Error checking stats status:', error);
    } finally {
      setLoading(false);
    }
  };

  const dismissPrompt = () => {
    setShouldShowPrompt(false);
  };

  const refreshStatsCheck = () => {
    if (user) {
      checkStatsStatus();
    }
  };

  return {
    shouldShowPrompt,
    loading,
    dismissPrompt,
    refreshStatsCheck
  };
}