export type Point = [number, number];
export type Partner = {
  key: string;
  id: number;
  service: string;
  name: string;
  vehicle: string;
  country: string;
  city: string;
  city_label: string;
  state: string;
  online: boolean;
  position: {
    coordinates: Point | null;
    updated_at: string | null;
    fresh: boolean;
  };
  jobs: string[];
};
export type Job = {
  key: string;
  id: number;
  service: string;
  status: string;
  country: string;
  city: string;
  city_label: string;
  pickup_label: string;
  dropoff_label: string;
  pickup: Point | null;
  dropoff: Point | null;
  created_at: string;
};
export type Snapshot = {
  generated_at: string;
  freshness_seconds: number;
  truncated: boolean;
  partners: Partner[];
  jobs: Job[];
};
export const labels: Record<string, string> = {
  busy: 'Prestation en cours',
  pickup: 'En route vers le retrait',
  available: 'Disponible',
  unavailable: 'Indisponible',
  stale: 'Position ancienne ou absente',
};
export const colors: Record<string, string> = {
  busy: '#15803d',
  pickup: '#d97706',
  available: '#2563eb',
  unavailable: '#64748b',
  stale: '#64748b',
};
export function fresh(p: Partner, now: number, limit = 120) {
  const stamp = p.position.updated_at ? Date.parse(p.position.updated_at) : NaN;
  return (
    !!p.position.coordinates &&
    Number.isFinite(stamp) &&
    now - stamp >= 0 &&
    now - stamp <= limit * 1000
  );
}

export const jobLabels: Record<string, string> = {
  pending: 'En attente',
  searching: 'Recherche en cours',
  operator_required: 'Intervention opérateur',
  accepted: 'Chauffeur en route',
  assigned: 'Livreur en route',
  in_progress: 'Course en cours',
  picked_up: 'Colis retiré',
};
