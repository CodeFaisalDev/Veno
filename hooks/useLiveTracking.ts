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

        // Setup Interpolation snapshots
        const prev = nextRef.current || presenceData;
        const next = presenceData;
        
        prevRef.current = prev;
        nextRef.current = next;

        // Cancel previous animation frame
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        const startTime = Date.now();
        // Expect updates every 15 seconds
        const duration = 15000; 

        const animate = () => {
          if (!prevRef.current || !nextRef.current) return;

          const elapsed = Date.now() - startTime;
          const t = Math.min(elapsed / duration, 1); // Clamp between 0 and 1

          // Linear interpolation (lerp)
          const lat = prevRef.current.lat + (nextRef.current.lat - prevRef.current.lat) * t;
          const lng = prevRef.current.lng + (nextRef.current.lng - prevRef.current.lng) * t;
          
          // Heading interpolation (handles minor direction changes)
          const heading = prevRef.current.heading + (nextRef.current.heading - prevRef.current.heading) * t;

          setInterpolatedCoords({
            latitude: lat,
            longitude: lng,
            heading: heading || 0,
          });

          if (t < 1) {
            animationFrameRef.current = requestAnimationFrame(animate);
          }
        };

        animationFrameRef.current = requestAnimationFrame(animate);
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
