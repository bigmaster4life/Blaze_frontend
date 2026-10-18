'use client';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Partner, Job, colors, fresh, Point } from './types';
export default function LiveMap({
  partners,
  jobs,
  selected,
  onSelect,
  now,
  scope,
}: {
  partners: Partner[];
  jobs: Job[];
  selected: string | null;
  onSelect: (key: string) => void;
  now: number;
  scope: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef('');
  const focused = useRef<string | null>(null);
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    fitted.current = '';
    focused.current = null;
    const m = L.map(host.current).setView([0.39, 9.45], 12);
    map.current = m;
    layer.current = L.layerGroup().addTo(m);
    L.tileLayer(
      process.env.NEXT_PUBLIC_SUPERVISION_TILE_URL ||
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }
    )
      .on('tileerror', () => setTileError(true))
      .addTo(m);
    const observer = new ResizeObserver(() => m.invalidateSize());
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current,
      g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const points: Point[] = [];
    partners.forEach((p) => {
      const pt = p.position.coordinates;
      if (!pt) return;
      points.push(pt);
      const color = colors[fresh(p, now) ? p.state : 'stale'];
      const text = document.createElement('span');
      text.textContent = `${p.name} · ${
        p.service === 'vtc' ? 'VTC' : 'Livraison'
      }`;
      L.circleMarker(pt, {
        radius: selected === p.key ? 12 : 8,
        color,
        fillColor: color,
        fillOpacity: 0.85,
        weight: selected === p.key ? 4 : 2,
      })
        .bindTooltip(text)
        .on('click', () => onSelect(p.key))
        .addTo(g);
    });
    const p = partners.find((p) => p.key === selected);
    if (p?.position.coordinates && focused.current !== selected) {
      m.setView(p.position.coordinates, Math.max(m.getZoom(), 14));
    }
    focused.current = selected;
    const active = jobs.filter((j) => p?.jobs.includes(j.key));
    active.forEach((j) => {
      if (j.pickup) {
        L.circleMarker(j.pickup, {
          radius: 6,
          color: '#111827',
          fillOpacity: 1,
        })
          .bindTooltip('Retrait')
          .addTo(g);
      }
      if (j.dropoff) {
        L.circleMarker(j.dropoff, {
          radius: 6,
          color: '#7c3aed',
          fillOpacity: 1,
        })
          .bindTooltip('Destination')
          .addTo(g);
      }
      if (j.pickup && j.dropoff)
        L.polyline([j.pickup, j.dropoff], {
          color: '#7c3aed',
          dashArray: '5 8',
          weight: 2,
        }).addTo(g);
    });
    if (!points.length)
      jobs.forEach((j) => {
        if (j.pickup) points.push(j.pickup);
      });
    if (points.length && fitted.current !== scope) {
      m.fitBounds(L.latLngBounds(points), { padding: [35, 35], maxZoom: 14 });
      fitted.current = scope;
    }
  }, [partners, jobs, selected, onSelect, now, scope]);
  return (
    <div className="relative">
      <div
        ref={host}
        style={{ height: 'min(65vh,620px)', minHeight: 380, zIndex: 0 }}
        aria-label="Carte des chauffeurs et livreurs"
      />
      {tileError && (
        <p role="alert" className="notice-error">
          Le fond de carte est indisponible. La liste reste accessible.
        </p>
      )}
    </div>
  );
}
