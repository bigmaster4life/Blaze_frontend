// src/app/locations/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getAccessToken } from '@/utils/api';
import Image from 'next/image';

type RentalStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'finished'
  | 'canceled'
  | 'expired';

type Rental = {
  id: number;
  vehicle: number; // id véhicule
  user: number; // id user
  start_date: string;
  end_date: string;
  status: RentalStatus;
  payment_method?: 'cash' | 'wallet' | 'mobile';
  total_amount?: string | number;
  hold_expires_at?: string | null;
  identification_code?: string | null;
  created_at?: string;

  // 🔹 Infos client (si exposées par le serializer)
  renter_phone?: string | null;
  renter_name?: string | null;
};

type Vehicle = {
  id: number;
  brand: string;
  model: string;
  registration_number: string;
  city?: string;
  category?: string;
  image?: string | null;
  daily_price?: string | number;
  owner_phone?: string | null; // exposé par le serializer
  owner_name?: string | null; // ⬅️ si dispo côté backend, on l’affiche
};

type DRFPaginated<T> = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
};

function isPaginated<T>(p: DRFPaginated<T> | T[]): p is DRFPaginated<T> {
  return typeof (p as DRFPaginated<T>).results !== 'undefined';
}

function hasDetail(obj: unknown): obj is { detail?: unknown } {
  return typeof obj === 'object' && obj !== null && 'detail' in obj;
}

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000/api')
  .replace(/\/+$/, ''); // .../api

// --- util fetch JSON avec Bearer ---
async function getJSON<T>(
  path: string,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  const access = getAccessToken();
  if (!access) throw new Error('NO_TOKEN');
  const qs = params
    ? `?${new URLSearchParams(
        Object.entries(params).reduce<Record<string, string>>(
          (acc, [k, v]) => {
            if (v !== undefined && v !== null) acc[k] = String(v);
            return acc;
          },
          {}
        )
      ).toString()}`
    : '';
  const res = await fetch(`${API_BASE}${path}${qs}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${access}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    let reason = `HTTP_${res.status}`;
    try {
      const j: unknown = await res.json();
      if (
        hasDetail(j) &&
        typeof j.detail === 'string' &&
        j.detail.trim()
      ) {
        reason = j.detail;
      }
    } catch {
      /* ignore */
    }
    throw new Error(reason);
  }
  return (await res.json()) as T;
}

async function postJSON<T>(
  path: string,
  body?: Record<string, unknown> | null
): Promise<T> {
  const access = getAccessToken();
  if (!access) throw new Error('NO_TOKEN');
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${access}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let reason = `HTTP_${res.status}`;
    try {
      const j: unknown = await res.json();
      if (
        hasDetail(j) &&
        typeof j.detail === 'string' &&
        j.detail.trim()
      ) {
        reason = j.detail;
      }
    } catch {
      /* ignore */
    }
    throw new Error(reason);
  }
  // certains endpoints peuvent renvoyer 204 (vide)
  try {
    return (await res.json()) as T;
  } catch {
    return {} as T;
  }
}

function currencyXAF(n?: string | number | null) {
  const val = Number(n ?? 0);
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XAF',
    maximumFractionDigits: 0,
  }).format(val);
}

function StatusPill({ status }: { status: RentalStatus }) {
  const map: Record<RentalStatus, string> = {
    pending: 'bg-amber-100 text-amber-800',
    confirmed: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-indigo-100 text-indigo-800',
    finished: 'bg-emerald-100 text-emerald-800',
    canceled: 'bg-rose-100 text-rose-800',
    expired: 'bg-slate-100 text-slate-700',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded ${map[status]}`}>
      {status}
    </span>
  );
}

// 🔹 Formatage logique de la méthode de paiement
function formatPaymentMethod(r: Rental): string {
  if (!r.payment_method) return '—';

  // Cash ne doit pas apparaître tant que ce n'est pas confirmé
  if (r.payment_method === 'cash' && r.status === 'pending') {
    return '—';
  }

  if (r.payment_method === 'mobile') {
    const base = 'Mobile Money';
    if (['confirmed', 'in_progress', 'finished'].includes(r.status)) {
      return `${base} (payé)`;
    }
    return base;
  }

  if (r.payment_method === 'wallet') return 'Wallet';
  if (r.payment_method === 'cash') return 'Cash';

  return r.payment_method;
}

export default function LocationsPage() {
  // Filtres basiques: ville + période
  const [city, setCity] = useState('');
  const [range, setRange] = useState<{ from: string; to: string }>(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 30);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    };
  });

  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [rows, setRows] = useState<Rental[]>([]);
  const [vehicles, setVehicles] = useState<Record<number, Vehicle>>({});

  // Drawer state
  const [selected, setSelected] = useState<Rental | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionLoading, setActionLoading] =
    useState<'confirm_cash' | 'start' | 'finish' | 'cancel' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const params = useMemo(
    () => ({ from: range.from, to: range.to, ...(city ? { city } : {}) }),
    [range, city]
  );

  const explain = (e: unknown) => {
    if (e instanceof Error) {
      if (e.message === 'NO_TOKEN')
        return 'Non authentifié : connectez-vous pour accéder aux locations.';
      return e.message;
    }
    return 'Erreur inconnue.';
  };

  const load = useCallback(async () => {
    setLoading(true);
    setErrMsg(null);
    try {
      // 1) Récupère les rentals (tolérant pagination DRF)
      const payload = await getJSON<DRFPaginated<Rental> | Rental[]>(
        '/rental/',
        params
      );
      const rentals: Rental[] = isPaginated(payload)
        ? payload.results
        : payload;
      setRows(rentals);

      // 2) Récupère les véhicules manquants
      const neededVehicleIds = Array.from(
        new Set(rentals.map((r) => r.vehicle))
      ).filter((id) => !vehicles[id]);
      if (neededVehicleIds.length) {
        const fetched: Record<number, Vehicle> = { ...vehicles };
        await Promise.all(
          neededVehicleIds.map(async (id) => {
            try {
              const v = await getJSON<Vehicle>(`/vehicles/${id}/`);
              fetched[id] = v;
            } catch {
              /* ignore */
            }
          })
        );
        setVehicles(fetched);
      }

      // Rafraîchir l’élément sélectionné si le drawer est ouvert
      if (drawerOpen && selected) {
        const fresh = rentals.find((r) => r.id === selected.id) || null;
        setSelected(fresh);
      }
    } catch (e: unknown) {
      setErrMsg(explain(e));
    } finally {
      setLoading(false);
    }
  }, [params, vehicles, drawerOpen, selected]);

  useEffect(() => {
    load();
  }, [load]);

  const openDrawer = useCallback((r: Rental) => {
    setSelected(r);
    setActionError(null);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelected(null);
    setActionError(null);
  }, []);

  // -------- Actions back-office avec update optimiste --------
  type ActionResponse = Partial<
    Pick<Rental, 'status' | 'total_amount' | 'identification_code'>
  >;

  const doAction = useCallback(
    async (action: 'confirm_cash' | 'start' | 'finish' | 'cancel') => {
      if (!selected) return;
      setActionError(null);
      setActionLoading(action);
      try {
        const resp = await postJSON<ActionResponse>(
          `/rental/${selected.id}/${action}/`,
          action === 'confirm_cash' ? {} : undefined
        );

        // 1) mise à jour optimiste sur selected
        setSelected((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            ...(resp.status ? { status: resp.status } : null),
            ...(typeof resp.total_amount !== 'undefined'
              ? { total_amount: resp.total_amount }
              : null),
            ...(typeof resp.identification_code !== 'undefined'
              ? { identification_code: resp.identification_code }
              : null),
          };
        });

        // 2) mise à jour optimiste dans la liste
        setRows((prev) =>
          prev.map((r) =>
            r.id === selected.id
              ? {
                  ...r,
                  ...(resp.status ? { status: resp.status } : null),
                  ...(typeof resp.total_amount !== 'undefined'
                    ? { total_amount: resp.total_amount }
                    : null),
                  ...(typeof resp.identification_code !== 'undefined'
                    ? { identification_code: resp.identification_code }
                    : null),
                }
              : r
          )
        );

        // 3) rechargement serveur pour verrouiller l'état réel
        await load();
      } catch (e: unknown) {
        setActionError(explain(e));
      } finally {
        setActionLoading(null);
      }
    },
    [selected, load]
  );

  const v = selected ? vehicles[selected.vehicle] : null;
  const ownerPhone = v?.owner_phone || '—';
  const ownerName = v?.owner_name || '';

  // Règles d’affichage des actions (cohérentes avec le backend)
  const canConfirmCash =
    selected?.status === 'pending' || selected?.status === 'confirmed';
  const canStart =
    selected?.status === 'confirmed' || selected?.status === 'in_progress';
  const canFinish =
    selected?.status === 'in_progress' || selected?.status === 'confirmed';
  const canCancel = selected
    ? !['finished', 'canceled', 'expired'].includes(selected.status)
    : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">📍 Locations</h1>
        <Link
          href="/dashboard"
          className="ml-auto inline-flex items-center gap-2 px-3 py-2 rounded bg-slate-900 text-white hover:bg-slate-800"
        >
          ← Retour au Dashboard
        </Link>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-end gap-3 bg-white rounded-xl p-4 shadow">
        <div>
          <label className="block text-sm font-semibold mb-1">Ville</label>
          <input
            className="border rounded px-3 py-2"
            placeholder="(toutes)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Du</label>
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={range.from}
            onChange={(e) =>
              setRange((r) => ({ ...r, from: e.target.value }))
            }
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Au</label>
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={range.to}
            onChange={(e) =>
              setRange((r) => ({ ...r, to: e.target.value }))
            }
          />
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          className="ml-auto bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Chargement…' : 'Actualiser'}
        </button>
      </div>

      {/* Erreur */}
      {errMsg && (
        <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded px-4 py-3">
          {errMsg}
        </div>
      )}

      {/* Tableau */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Dates</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Client (nom / tél)</th>
              <th className="px-3 py-2">Véhicule</th>
              <th className="px-3 py-2">Proprio (nom / tél)</th>
              <th className="px-3 py-2">Montant</th>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="px-3 py-6 text-center text-gray-500"
                  colSpan={9}
                >
                  Aucune location sur la période.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const vrow = vehicles[r.vehicle];
                const title = vrow
                  ? `${vrow.brand} ${vrow.model} (${vrow.registration_number})`
                  : `#${r.vehicle}`;

                const ownerPhoneRow = vrow?.owner_phone || '—';
                const ownerNameRow = vrow?.owner_name || '';

                const renterPhoneRow = r.renter_phone || '—';
                const renterNameRow = r.renter_name || '';

                return (
                  <tr
                    key={r.id}
                    className="border-t hover:bg-slate-50 cursor-pointer"
                    onClick={() => openDrawer(r)}
                  >
                    <td className="px-3 py-2 font-mono">#{r.id}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <span>{new Date(r.start_date).toLocaleString()}</span>
                        <span className="text-gray-500 text-xs">
                          {new Date(r.end_date).toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-3 py-2">
                      {renterNameRow ? `${renterNameRow} — ` : ''}
                      {renterPhoneRow !== '—' ? (
                        <a
                          className="text-blue-600 hover:underline"
                          href={`tel:${renterPhoneRow.replace(/\s+/g, '')}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {renterPhoneRow}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2">{title}</td>
                    <td className="px-3 py-2">
                      {ownerNameRow ? `${ownerNameRow} — ` : ''}
                      {ownerPhoneRow !== '—' ? (
                        <a
                          className="text-blue-600 hover:underline"
                          href={`tel:${ownerPhoneRow.replace(/\s+/g, '')}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {ownerPhoneRow}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {typeof r.total_amount === 'undefined'
                        ? '—'
                        : currencyXAF(r.total_amount)}
                    </td>
                    <td className="px-3 py-2">
                      {r.identification_code || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-blue-600 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDrawer(r);
                        }}
                      >
                        Voir
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      {drawerOpen && selected && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={closeDrawer}
          />
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">
                Location #{selected.id}
              </h2>
              <button
                onClick={closeDrawer}
                className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200"
              >
                Fermer
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto">
              <div className="flex items-start gap-3">
                {v?.image ? (
                  <Image
                    src={v.image}
                    alt="veh"
                    width={96}
                    height={64}
                    className="object-cover rounded"
                  />
                ) : (
                  <div className="w-24 h-16 bg-slate-100 rounded" />
                )}
                <div>
                  <div className="font-semibold">
                    {v
                      ? `${v.brand} ${v.model} (${v.registration_number})`
                      : `Véhicule #${selected.vehicle}`}
                  </div>
                  <div className="text-sm text-slate-500">
                    {v?.city || '—'} • {v?.category || '—'}
                  </div>
                </div>
                <div className="ml-auto">
                  <StatusPill status={selected.status} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-slate-500">Début</div>
                  <div className="font-medium">
                    {new Date(
                      selected.start_date
                    ).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Fin</div>
                  <div className="font-medium">
                    {new Date(selected.end_date).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Montant</div>
                  <div className="font-medium">
                    {typeof selected.total_amount === 'undefined'
                      ? '—'
                      : currencyXAF(selected.total_amount)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Méthode paiement</div>
                  <div className="font-medium">
                    {formatPaymentMethod(selected)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Code</div>
                  <div className="font-medium">
                    {selected.identification_code || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Proprio</div>
                  <div className="font-medium">
                    {ownerName ? `${ownerName} — ` : ''}
                    {ownerPhone !== '—' ? (
                      <a
                        className="text-blue-600 hover:underline"
                        href={`tel:${ownerPhone.replace(/\s+/g, '')}`}
                      >
                        {ownerPhone}
                      </a>
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Client</div>
                  <div className="font-medium">
                    {selected.renter_name
                      ? `${selected.renter_name} — `
                      : ''}
                    {selected.renter_phone ? (
                      <a
                        className="text-blue-600 hover:underline"
                        href={`tel:${selected.renter_phone.replace(
                          /\s+/g,
                          ''
                        )}`}
                      >
                        {selected.renter_phone}
                      </a>
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
              </div>

              {actionError && (
                <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded px-3 py-2 text-sm">
                  {actionError}
                </div>
              )}

              <div className="border-t pt-3">
                <div className="text-sm text-slate-500 mb-2">Actions</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={!canConfirmCash || actionLoading !== null}
                    onClick={() => doAction('confirm_cash')}
                    className={`px-3 py-2 rounded text-white ${
                      canConfirmCash && actionLoading === null
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-emerald-300 cursor-not-allowed'
                    }`}
                  >
                    {actionLoading === 'confirm_cash'
                      ? 'Confirmation…'
                      : 'Confirmer cash'}
                  </button>

                  <button
                    disabled={!canStart || actionLoading !== null}
                    onClick={() => doAction('start')}
                    className={`px-3 py-2 rounded text-white ${
                      canStart && actionLoading === null
                        ? 'bg-indigo-600 hover:bg-indigo-700'
                        : 'bg-indigo-300 cursor-not-allowed'
                    }`}
                  >
                    {actionLoading === 'start'
                      ? 'Démarrage…'
                      : 'Démarrer'}
                  </button>

                  <button
                    disabled={!canFinish || actionLoading !== null}
                    onClick={() => doAction('finish')}
                    className={`px-3 py-2 rounded text-white ${
                      canFinish && actionLoading === null
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-blue-300 cursor-not-allowed'
                    }`}
                  >
                    {actionLoading === 'finish'
                      ? 'Clôture…'
                      : 'Terminer'}
                  </button>

                  <button
                    disabled={!canCancel || actionLoading !== null}
                    onClick={() => doAction('cancel')}
                    className={`px-3 py-2 rounded text-white ${
                      canCancel && actionLoading === null
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : 'bg-rose-300 cursor-not-allowed'
                    }`}
                  >
                    {actionLoading === 'cancel'
                      ? 'Annulation…'
                      : 'Annuler'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}