import { useEffect, useState } from 'react';
import { mockRadarDigest } from '../data/radarDigest.mock';
import { fetchLatestRadarDigest } from '../services/radarApi';
import type { RadarDigest } from '../types/radar';

export function useRadarDigest(): {
  digest: RadarDigest;
  loading: boolean;
  error: Error | null;
  usingFallback: boolean;
} {
  const [digest, setDigest] = useState<RadarDigest>(mockRadarDigest);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function load(showLoading: boolean) {
      if (showLoading) setLoading(true);
      try {
        const latest = await fetchLatestRadarDigest();
        if (cancelled) return;
        setDigest(latest);
        setError(null);
        setUsingFallback(false);
      } catch (caught) {
        if (cancelled) return;
        const nextError = caught instanceof Error ? caught : new Error(String(caught));
        setDigest(mockRadarDigest);
        setError(nextError);
        setUsingFallback(true);
      } finally {
        if (!cancelled && showLoading) {
          setLoading(false);
        }
      }
    }

    void load(true);
    timer = setInterval(() => {
      void load(false);
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  return { digest, loading, error, usingFallback };
}
