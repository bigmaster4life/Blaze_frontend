import type L from 'leaflet';

/** Track only tiles on this map. Successful individual tiles must not hide a stalled load. */
export function monitorTiles(layer: L.TileLayer, report: (state: { loading: boolean; error: boolean }) => void) {
  let disposed = false;
  let loading = true;
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const failures = new Set<string>();
  const publish = () => { if (!disposed) report({ loading, error: timedOut || failures.size > 0 }); };
  const start = () => {
    clearTimeout(timer);
    timedOut = false;
    loading = true;
    publish();
    timer = setTimeout(() => { timedOut = true; loading = false; publish(); }, 15000);
  };
  const tileKey = (event: L.LeafletEvent) => ((event as L.TileEvent).tile as HTMLImageElement).src;
  const handlers = {
    loading: start,
    tileerror: (event: L.LeafletEvent) => { failures.add(tileKey(event)); publish(); },
    tileload: (event: L.LeafletEvent) => { failures.delete(tileKey(event)); publish(); },
    tileunload: (event: L.LeafletEvent) => { failures.delete(tileKey(event)); publish(); },
    load: () => { clearTimeout(timer); loading = false; timedOut = false; publish(); },
  };
  for (const [name, handler] of Object.entries(handlers)) layer.on(name, handler);
  return {
    retry: () => { if (!disposed) { failures.clear(); start(); layer.redraw(); } },
    dispose: () => {
      disposed = true;
      clearTimeout(timer);
      for (const [name, handler] of Object.entries(handlers)) layer.off(name, handler);
    },
  };
}
