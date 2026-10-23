"use client";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./LiveMap.module.css";
import { monitorTiles } from "./tileHealth";
import { Partner, Job, colors, fresh, Point } from "./types";
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
  const fitted = useRef("");
  const focused = useRef<string | null>(null);
  const [tileError, setTileError] = useState(false);
  const [tilesLoading, setTilesLoading] = useState(true);
  const retryTiles = useRef<() => void>(() => {});
  useEffect(() => {
    if (!host.current) return;
    fitted.current = "";
    focused.current = null;
    // A monitoring map favours complete, stable tiles over opacity/zoom effects.
    const m = L.map(host.current, {
      fadeAnimation: false,
      zoomAnimation: false,
      markerZoomAnimation: false,
    }).setView([0.39, 9.45], 12);
    map.current = m;
    layer.current = L.layerGroup().addTo(m);
    let alive = true;
    let resizeFrame: number | undefined;
    const tiles = L.tileLayer(
      process.env.NEXT_PUBLIC_SUPERVISION_TILE_URL ||
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }
    );
    const health = monitorTiles(tiles, ({ loading, error }) => {
      setTilesLoading(loading);
      setTileError(error);
    });
    retryTiles.current = () => {
      m.invalidateSize({ pan: false });
      health.retry();
    };
    tiles.addTo(m);
    const resize = () => {
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        if (alive) m.invalidateSize({ pan: false });
      });
    };
    const visible = () => {
      if (document.visibilityState === "visible") resize();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host.current);
    document.addEventListener("visibilitychange", visible);
    resize();
    return () => {
      alive = false;
      health.dispose();
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
      document.removeEventListener("visibilitychange", visible);
      retryTiles.current = () => {};
      observer.disconnect();
      tiles.off();
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
      const color = colors[fresh(p, now) ? p.state : "stale"];
      const text = document.createElement("span");
      text.textContent = `${p.name} · ${
        p.service === "vtc" ? "VTC" : "Livraison"
      }`;
      L.circleMarker(pt, {
        radius: selected === p.key ? 12 : 8,
        color,
        fillColor: color,
        fillOpacity: 0.85,
        weight: selected === p.key ? 4 : 2,
      })
        .bindTooltip(text)
        .on("click", () => onSelect(p.key))
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
          color: "#111827",
          fillOpacity: 1,
        })
          .bindTooltip("Retrait")
          .addTo(g);
      }
      if (j.dropoff) {
        L.circleMarker(j.dropoff, {
          radius: 6,
          color: "#7c3aed",
          fillOpacity: 1,
        })
          .bindTooltip("Destination")
          .addTo(g);
      }
      if (j.pickup && j.dropoff)
        L.polyline([j.pickup, j.dropoff], {
          color: "#7c3aed",
          dashArray: "5 8",
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
    <div className={styles.map}>
      <div
        ref={host}
        style={{ height: "min(65vh,620px)", minHeight: 380, zIndex: 0 }}
        aria-label="Carte des chauffeurs et livreurs"
      />
      {tilesLoading && !tileError && (
        <p className={styles.notice} role="status">
          Chargement du fond de carte…
        </p>
      )}
      {tileError && (
        <p role="alert" className={styles.notice}>
          Le fond de carte n’a pas pu être chargé entièrement. Les positions et
          la liste restent disponibles.
          <button onClick={() => retryTiles.current()}>
            Recharger la carte
          </button>
        </p>
      )}
    </div>
  );
}
