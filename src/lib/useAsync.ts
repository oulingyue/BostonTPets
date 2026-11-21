import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/** Runs `load` every time the screen gains focus (e.g. after a scan, the collection refreshes). */
export function useFocusedData<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await load());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { data, error, loading, refresh };
}
