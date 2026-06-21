import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

export function useMapStatus(shouldIncrement = false) {
  const [mapEnabled, setMapEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;

    async function checkStatus() {
      try {
        if (shouldIncrement) {
          // Increment and fetch updated status via Edge Function
          const { data, error } = await supabase.functions.invoke('increment-map-load', {
            method: 'POST'
          });
          // If the edge function fails (e.g. not deployed yet), just allow maps
          if (error) {
            console.warn('Map load increment failed (edge function may not be deployed):', error.message);
            if (active) setMapEnabled(true);
            return;
          }
          if (active && data) {
            setMapEnabled(data.map_enabled);
          }
        } else {
          // Just fetch status from table
          const { data, error } = await supabase
            .from('usage_tracker')
            .select('map_enabled')
            .eq('id', '00000000-0000-0000-0000-000000000000')
            .single();

          if (error) {
            // PGRST205 = table not found in schema cache (migration not yet applied)
            // PGRST116 = no rows returned
            // In both cases, default to maps enabled
            const safeErrorCodes = ['PGRST205', 'PGRST116', '42P01'];
            const code = (error as any).code || '';
            if (safeErrorCodes.includes(code)) {
              console.warn('usage_tracker table not available yet — defaulting to mapEnabled=true');
            } else {
              console.warn('Error fetching map status:', error.message);
            }
            if (active) setMapEnabled(true);
            return;
          }

          if (active && data) {
            setMapEnabled(data.map_enabled);
          }
        }
      } catch (err: any) {
        // Network errors or unexpected failures — always allow maps
        console.warn('useMapStatus catch-all:', err?.message || err);
        if (active) {
          setMapEnabled(true);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    checkStatus();

    return () => {
      active = false;
    };
  }, [shouldIncrement]);

  return { mapEnabled, loading };
}
