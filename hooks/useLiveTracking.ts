import { useEffect, useState, useRef } from 'react';
import { supabase } from '../utils/supabase';

export interface LocationSnapshot {
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  timestamp: number;
}

export function useLiveTracking(requestId: string | null) {
  const [donorLocation, setDonorLocation] = useState<LocationSnapshot | null>(null);
  const [interpolatedCoords, setInterpolatedCoords] = useState<{
    latitude: number;
    longitude: number;
    heading: number;
  } | null>(null);
  const [isEnRoute, setIsEnRoute] = useState<boolean>(false);

  // References to keep animation loop parameters
  const prevRef = useRef<LocationSnapshot | null>(null);
  const nextRef = useRef<LocationSnapshot | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!requestId) return;

    const channel = supabase.channel(`tracking:${requestId}`);

    const handleSync = () => {
      const state = channel.presenceState();
      
      // Get the first active presence record
      const presences = Object.values(state).flat() as any[];
      const presenceData = presences?.[0] as LocationSnapshot | undefined;

      if (presenceData) {
        setIsEnRoute(true);
        setDonorLocation(presenceData);

        setInterpolatedCoords({
          latitude: presenceData.lat,
          longitude: presenceData.lng,
          heading: presenceData.heading || 0,
        });
      }
    };

    channel
      .on('presence', { event: 'sync' }, handleSync)
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to tracking Presence channel for request ${requestId}`);
        }
      });

    return () => {
      channel.unsubscribe();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [requestId]);

  return { donorLocation, interpolatedCoords, isEnRoute };
}
