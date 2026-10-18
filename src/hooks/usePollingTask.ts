'use client';
import { useEffect, useRef } from 'react';

/** No overlapping requests; an invisible browser tab does not poll the API. */
export function usePollingTask(
  task: () => Promise<void>,
  enabled: boolean,
  delay: number,
  refreshKey?: string
) {
  const latest = useRef(task);
  useEffect(() => {
    latest.current = task;
  }, [task]);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      if (disposed || running) return;
      clearTimeout(timer);
      if (document.visibilityState === 'hidden') return;
      running = true;
      try {
        await latest.current();
      } finally {
        running = false;
        if (!disposed) timer = setTimeout(() => void run(), delay);
      }
    };
    const visible = () => {
      if (document.visibilityState === 'visible') void run();
      else clearTimeout(timer);
    };
    void run();
    document.addEventListener('visibilitychange', visible);
    return () => {
      disposed = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [enabled, delay, refreshKey]);
}
