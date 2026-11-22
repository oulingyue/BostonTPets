import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/** A readable message. Some client errors fail `instanceof Error` and would otherwise show "[object Object]". */
export function errorText(e: unknown): string {
  if (typeof e === 'string' && e) return e;
  if (e && typeof e === 'object') {
    const record = e as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint].filter((part) => typeof part === 'string' && part);
    if (parts.length) return parts.join('\n');
  }
  return 'Something went wrong';
}

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
      setError(errorText(e));
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
