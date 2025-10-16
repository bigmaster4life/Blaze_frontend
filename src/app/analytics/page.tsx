'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { getAccessToken } from '@/utils/api';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000/api').replace(/\/+$/,'');
const WS_BASE  = (process.env.NEXT_PUBLIC_WS_BASE  || 'ws://localhost:8000').replace(/\/+$/,'');

// ---- classes / helpers d'erreurs
class ApiError extends Error {
  code?: 'NO_TOKEN' | string;
  status?: number;
  body?: unknown;
  constructor(message: string, opts?: { code?: string; status?: number; body?: unknown }) {
    super(message);
    this.code = opts?.code;
    this.status = opts?.status;
    this.body = opts?.body;
  }
}
function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

// ---- types API
type Summary = {
  rides_live: number;
  rides_waiting_pickup: number;
  rides_completed: number;
  cancel_rate: number;
  avg_pickup_time_sec: number;
  avg_ride_duration_sec: number;
  rentals_active: number;
  incidents_last_hour: number;
  tickets_open: number;
  gmv: number;
  drivers_earnings: number;
  platform_commission: number;
};
type LiveRow = {
  id: number;
  type: 'ride' | 'rental';
  status: string;
  city: string;
  driver?: string;
  client?: string;
  amount?: number;
  updatedAt: string;
};

// ---- fetch JSON (Bearer obligatoire)
async function getJSON<T>(url: string, params?: Record<string, string>) {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
  const access = getAccessToken();
  if (!access) {
    throw new ApiError('NO_TOKEN', { code: 'NO_TOKEN' });
  }
  const res = await fetch(`${url}${qs}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${access}`,
    },
  });
  if (!res.ok) {
    let body: unknown = null;
    try { body = await res.json(); } catch { /* no-op */ }
    throw new ApiError(`HTTP_${res.status}`, { status: res.status, body });
  }
  return (await res.json()) as T;
}

function currencyXAF(n?: number) {
  const v = Number(n || 0);
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(v);
}

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow p-4 ${className ?? ''}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-slate-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}
function Kpi({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="text-2xl font-extrabold text-slate-900 mt-1">{value ?? '—'}</div>
    </div>
  );
}

// ---- page
export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);

  // filtres
  const [city, setCity] = useState('');
  const [range, setRange] = useState<{ from: string; to: string }>({ from: '', to: '' });

  // états
  const [summary, setSummary] = useState<Summary | null>(null);
  const [ridesPerHour, setRidesPerHour] = useState<{ t: string; rides: number }[]>([]);
  const [revenueDaily, setRevenueDaily] = useState<{ d: string; gmv: number; commission: number }[]>([]);
  const [paymentSplit, setPaymentSplit] = useState<Record<'cash' | 'mobile_money' | 'wallet', number>>({ cash: 0, mobile_money: 0, wallet: 0 });
  const [drivers, setDrivers] = useState<{ id: number; name: string; rides: number; rating: number; revenue: number }[]>([]);
  const [issues, setIssues] = useState<{ ts: string; type: string; message: string; count: number }[]>([]);
  const [live, setLive] = useState<LiveRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [wsStatus, setWsStatus] = useState<'closed'|'connecting'|'open'>('closed');
  const retryRef = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (range.from) p.from = range.from;
    if (range.to)   p.to   = range.to;
    if (city)       p.city = city;
    return p;
  }, [range.from, range.to, city]);

  const base = useMemo(() => `${API_BASE}/admin/analytics`, []);

  const explainErr = (e: ApiError | Error | unknown) => {
    if (isApiError(e)) {
      if (e.code === 'NO_TOKEN') return "Non authentifié : aucun jeton d’accès (JWT). Connecte-toi pour obtenir un token.";
      if (e.status === 401)       return "Non autorisé (401). Token invalide/expiré.";
      if (e.status === 403)       return "Accès refusé (403). Permissions insuffisantes.";
      if (e.status && e.body)     return `Erreur ${e.status} : ${typeof e.body === 'string' ? e.body : JSON.stringify(e.body)}`;
      return e.message || "Erreur inconnue côté API.";
    }
    if (e instanceof Error) return e.message || "Erreur inconnue.";
    return "Échec du chargement des données. Vérifie l’API, l’ASGI (Daphne) et CORS.";
  };

  const loadAll = useCallback(async () => {
    if (!range.from || !range.to) return;
    setLoading(true);
    setErrMsg(null);
    try {
      const [s, rh, rev, sp, td, is, lv] = await Promise.all([
        getJSON<Summary>(`${base}/summary/`, params),
        getJSON<{ t: string; rides: number }[]>(`${base}/timeseries/`, {
          metric: 'rides_per_hour',
          day: new Date().toISOString().slice(0, 10),
          ...(city ? { city } : {}),
        }),
        getJSON<{ d: string; gmv: number; commission: number }[]>(`${base}/revenue_daily/`, params),
        getJSON<Record<'cash' | 'mobile_money' | 'wallet', number>>(`${base}/payment_split/`, params),
        getJSON<{ id: number; name: string; rides: number; rating: number; revenue: number }[]>(`${base}/top_drivers/`, {
          ...params,
          limit: '10',
        }),
        getJSON<{ ts: string; type: string; message: string; count: number }[]>(`${base}/issues/`, { limit: '30' }),
        getJSON<LiveRow[]>(`${base}/live/`, { limit: '30' }),
      ]);

      setSummary(s);
      setRidesPerHour(rh);
      setRevenueDaily(rev);
      setPaymentSplit(sp);
      setDrivers(td);
      setIssues(is);
      setLive(lv);
    } catch (e: unknown) {
      setErrMsg(explainErr(e));
    } finally {
      setLoading(false);
    }
  }, [params, city, base, range.from, range.to]);

  // init côté client (évite hydration mismatch)
  useEffect(() => {
    setMounted(true);
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 30);
    setRange({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });
  }, []);

  useEffect(() => {
    if (!range.from || !range.to) return;
    loadAll();
  }, [loadAll, range.from, range.to]);

  // WebSocket temps réel
  const openWS = useCallback(() => {
    const token = getAccessToken() || '';
    const url = `${WS_BASE}/ws/ops/?token=${encodeURIComponent(token)}`;
    try {
      setWsStatus('connecting');
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('open');
        retryRef.current = 0;
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as { type?: string; payload?: unknown; ts?: string; severity?: string; message?: string };
          switch (msg?.type) {
            case 'ride.status_changed':
            case 'rental.status_changed':
              setLive((prev) => [msg.payload as LiveRow, ...prev].slice(0, 40));
              break;
            case 'payment.status':
              loadAll();
              break;
            case 'system.issue':
              setIssues((prev) => [
                { ts: msg.ts || new Date().toISOString(), type: msg.severity || 'issue', message: msg.message || '—', count: 1 },
                ...prev,
              ].slice(0, 50));
              break;
            default:
              break;
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        setWsStatus('closed');
        const delay = Math.min(30000, 1000 * Math.pow(2, retryRef.current));
        retryRef.current += 1;
        setTimeout(() => {
          if (wsRef.current === ws) openWS();
        }, delay);
      };

      ws.onerror = () => { try { ws.close(); } catch {} };
    } catch {
      setWsStatus('closed');
    }
  }, [loadAll]);

  useEffect(() => {
    openWS();
    return () => { try { wsRef.current?.close(); } catch {}; wsRef.current = null; };
  }, [openWS]);

  const pieData = useMemo(
    () => [
      { name: 'Cash', value: paymentSplit.cash },
      { name: 'Mobile Money', value: paymentSplit.mobile_money },
      { name: 'Blaze Wallet', value: paymentSplit.wallet },
    ],
    [paymentSplit]
  );

  const tokenMissing = mounted ? !getAccessToken() : false;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">📊 Analytique</h1>
          <span className={`text-xs px-2 py-1 rounded ${
            wsStatus === 'open' ? 'bg-green-100 text-green-700'
            : wsStatus === 'connecting' ? 'bg-amber-100 text-amber-700'
            : 'bg-slate-100 text-slate-600'
          }`}>WS: {wsStatus}</span>
        </div>
        {/* ➜ Bouton Retour Dashboard */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 bg-white text-slate-800 border border-slate-200 px-3 py-2 rounded-lg shadow hover:bg-slate-50"
        >
          ↩ Retour au Dashboard
        </Link>
      </div>

      {/* bandeau login si token manquant (client only) */}
      {mounted && tokenMissing && (
        <div className="bg-amber-50 text-amber-800 border border-amber-200 rounded px-4 py-3">
          Vous n’êtes pas authentifié(e). <a href="/login" className="underline font-semibold">Se connecter</a>
        </div>
      )}

      {/* Bandeau d’erreur */}
      {errMsg && (
        <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded px-4 py-3">
          {errMsg}
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap items-end gap-3">
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
          <label className="block text-sm font-semibold mb-1">Période — du</label>
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">au</label>
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </div>
        <button
          className="ml-auto bg-slate-900 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={() => loadAll()}
          disabled={loading || !range.from || !range.to}
        >
          {loading ? 'Chargement…' : 'Actualiser'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
        <Kpi title="Courses en cours" value={summary?.rides_live ?? '—'} />
        <Kpi title="En attente pickup" value={summary?.rides_waiting_pickup ?? '—'} />
        <Kpi title="Courses complétées" value={summary?.rides_completed ?? '—'} />
        <Kpi title="Taux d’annulation" value={summary ? `${(summary.cancel_rate * 100).toFixed(1)} %` : '—'} />
        <Kpi title="Pickup moyen" value={summary ? `${Math.round(summary.avg_pickup_time_sec / 60)} min` : '—'} />
        <Kpi title="Durée moyenne" value={summary ? `${Math.round(summary.avg_ride_duration_sec / 60)} min` : '—'} />
        <Kpi title="Loc. actives" value={summary?.rentals_active ?? '—'} />
        <Kpi title="Incidents (1h)" value={summary?.incidents_last_hour ?? '—'} />
        <Kpi title="Tickets ouverts" value={summary?.tickets_open ?? '—'} />
        <Kpi title="GMV (période)" value={summary ? currencyXAF(summary.gmv) : '—'} />
        <Kpi title="Gains chauffeurs" value={summary ? currencyXAF(summary.drivers_earnings) : '—'} />
        <Kpi title="Commission plateforme" value={summary ? currencyXAF(summary.platform_commission) : '—'} />
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card title="Courses par heure (aujourd’hui)" className="xl:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={ridesPerHour}>
              <XAxis dataKey="t" tickFormatter={(v) => String(v).slice(11, 16)} />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="rides" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Répartition paiements (période)">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100} label>
                {pieData.map((_, i) => (
                  <Cell key={i} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Revenu par jour (30j)" className="xl:col-span-3">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueDaily}>
              <XAxis dataKey="d" />
              <YAxis />
              <Tooltip formatter={(v) => currencyXAF(Number(v))} />
              <Bar dataKey="gmv" />
              <Bar dataKey="commission" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Flux en direct">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Type</th>
                  <th>Statut</th>
                  <th>Ville</th>
                  <th>Chauffeur</th>
                  <th>Montant</th>
                  <th>MAJ</th>
                </tr>
              </thead>
              <tbody>
                {live.map((row) => (
                  <tr key={`${row.type}-${row.id}-${row.updatedAt}`} className="border-b last:border-0">
                    <td className="py-2">{row.type}</td>
                    <td>{row.status}</td>
                    <td>{row.city}</td>
                    <td>{row.driver ?? '—'}</td>
                    <td>{row.amount ? currencyXAF(row.amount) : '—'}</td>
                    <td>{new Date(row.updatedAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Top chauffeurs (période)">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Chauffeur</th>
                  <th>Courses</th>
                  <th>Note</th>
                  <th>Revenu généré</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d) => (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="py-2">{d.name}</td>
                    <td>{d.rides}</td>
                    <td>{d.rating?.toFixed(1) ?? '—'}</td>
                    <td>{currencyXAF(d.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Incidents récents" className="xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Heure</th>
                  <th>Type</th>
                  <th>Message</th>
                  <th>Nb</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((it, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="py-2">{new Date(it.ts).toLocaleString()}</td>
                    <td>{it.type}</td>
                    <td className="truncate max-w-[520px]">{it.message}</td>
                    <td>{it.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}