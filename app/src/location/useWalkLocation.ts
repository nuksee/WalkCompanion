import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export type PermissionState = 'unknown' | 'granted' | 'denied';

export interface WalkPosition {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

/**
 * Requests foreground location permission and streams position updates
 * tuned for walking pace. Background tracking is a later step.
 */
export function useWalkLocation(enabled: boolean) {
  const [permission, setPermission] = useState<PermissionState>('unknown');
  const [position, setPosition] = useState<WalkPosition | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        setPermission('denied');
        return;
      }
      setPermission('granted');
      try {
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000,
            distanceInterval: 10,
          },
          (loc) => {
            setPosition({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              accuracy: loc.coords.accuracy,
              timestamp: loc.timestamp,
            });
          },
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);

  return { permission, position, error };
}
