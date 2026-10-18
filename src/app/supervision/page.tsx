'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import api, { apiErrorMessage } from '@/utils/api';
import { usePollingTask } from '@/hooks/usePollingTask';
import { Snapshot, labels, colors, fresh, jobLabels } from './types';
const LiveMap = dynamic(() => import('./LiveMap'), {
  ssr: false,
  loading: () => <p role="status">Chargement de la carte…</p>,
});
export default function SupervisionPage() {
  const { user } = useAuth();
  const permitted =
    !!user &&
    !!(
      user.is_superuser ||
      (user.is_staff && user.user_type === 'manager_staff')
    );
  const [data, setData] = useState<Snapshot | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [country, setCountry] = useState('all'),
    [city, setCity] = useState('all'),
    [service, setService] = useState('all'),
    [state, setState] = useState('all'),
    [selected, setSelected] = useState<string | null>(null),
    [now, setNow] = useState(Date.now());
  const disposed = useRef(false);
  const clockOffset = useRef(0);
  useEffect(() => {
    disposed.current = false;
    const t = setInterval(
      () => setNow(Date.now() + clockOffset.current),
      10000
    );
    return () => {
      disposed.current = true;
      clearInterval(t);
    };
  }, []);
  const load = async () => {
    try {
      const { data: d } = await api.get<Snapshot>('/supervision/');
      if (disposed.current) return;
      clockOffset.current = Date.parse(d.generated_at) - Date.now();
      setNow(Date.parse(d.generated_at));
      setData(d);
      setError('');
    } catch (e) {
      if (!disposed.current) setError(apiErrorMessage(e));
    } finally {
      if (!disposed.current) setLoading(false);
    }
  };
  usePollingTask(load, permitted, 10000);
  const outdated = !!data && now - Date.parse(data.generated_at) > 30000;
  const places = useMemo(
    () => [...(data?.partners || []), ...(data?.jobs || [])],
    [data]
  );
  const cities = Array.from(
    new Map(
      places
        .filter((p) => country === 'all' || p.country === country)
        .map((p) => [p.city, p.city_label])
    ).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));
  const matching = (p: { country: string; city: string; service: string }) =>
    (country === 'all' || p.country === country) &&
    (city === 'all' || p.city === city) &&
    (service === 'all' || p.service === service);
  const partners = (data?.partners || []).filter(
    (p) =>
      matching(p) &&
      (state === 'all' ||
        (state === 'stale'
          ? !fresh(p, now)
          : fresh(p, now) && p.state === state))
  );
  const jobs = (data?.jobs || []).filter(matching);
  const detail = partners.find((p) => p.key === selected);
  const select = useCallback((key: string) => setSelected(key), []);
  if (!permitted)
    return (
      <section className="panel">
        <h1>Accès réservé</h1>
        <p>La supervision est réservée aux gestionnaires et administrateurs.</p>
      </section>
    );
  return (
    <div className="space-y-5">
      <section className="panel p-5">
        <h1 className="text-2xl font-bold">Supervision en direct</h1>
        <p>
          VTC et livraisons · Actualisation toutes les 10 secondes lorsque cet
          écran est visible.
        </p>
        <p className="text-sm text-gray-500">
          Les positions de plus de 2 minutes sont signalées en gris. Le pays est
          renseigné uniquement pour les villes connues du catalogue.
        </p>
      </section>
      {error && (
        <div className="notice-error" role="alert">
          {error} <button onClick={() => void load()}>Réessayer</button>
        </div>
      )}
      {outdated && (
        <div className="notice-error" role="alert">
          Données anciennes : la dernière actualisation date de{' '}
          {new Date(data!.generated_at).toLocaleTimeString('fr-FR')}. Les
          positions affichées ne sont pas garanties actuelles.
        </div>
      )}
      {data?.truncated && (
        <p role="alert">
          Affichage partiel : plus de 2 000 éléments dans une catégorie. Affinez
          le périmètre avec votre administrateur.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {[
          [
            'Pays',
            country,
            setCountry,
            [
              ['all', 'Tous les pays'],
              ['GA', 'Gabon'],
              ['unknown', 'Pays non renseigné'],
            ],
          ],
          ['Ville', city, setCity, [['all', 'Toutes les villes'], ...cities]],
          [
            'Service',
            service,
            setService,
            [
              ['all', 'VTC et livraison'],
              ['vtc', 'VTC'],
              ['delivery', 'Livraison'],
            ],
          ],
          [
            'Statut',
            state,
            setState,
            [['all', 'Tous les statuts'], ...Object.entries(labels)],
          ],
        ].map(([label, value, setter, options]) => (
          <label
            key={label as string}
            className="flex flex-col text-sm font-semibold gap-1"
          >
            {label as string}
            <select
              className="rounded-lg border bg-white p-2"
              value={value as string}
              onChange={(e) => {
                (setter as (v: string) => void)(e.target.value);
                if (label === 'Pays') setCity('all');
                setSelected(null);
              }}
            >
              {(options as string[][]).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        {Object.entries(labels).map(([key, label]) => (
          <span key={key}>
            <span style={{ color: colors[key] }}>●</span> {label} :{' '}
            {
              partners.filter((p) =>
                key === 'stale'
                  ? !fresh(p, now)
                  : fresh(p, now) && p.state === key
              ).length
            }
          </span>
        ))}
        <strong>{jobs.length} prestation(s) active(s)</strong>
      </div>
      {loading ? (
        <p role="status">Chargement des positions…</p>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
          <section className="overflow-hidden rounded-xl border bg-white">
            <LiveMap
              partners={partners}
              jobs={jobs}
              selected={selected}
              onSelect={select}
              now={now}
              scope={`${country}:${city}:${service}:${state}`}
            />
            <p className="p-3 text-xs text-gray-500">
              Les pointillés relient le retrait à la destination ; ils ne
              représentent pas un itinéraire routier calculé.
            </p>
          </section>
          <section className="panel p-4 max-h-[720px] overflow-auto">
            <h2 className="font-bold">Partenaires · {partners.length}</h2>
            {!partners.length && <p>Aucun partenaire dans ce périmètre.</p>}
            {partners.map((p) => (
              <button
                key={p.key}
                onClick={() => select(p.key)}
                className={`block w-full text-left border-b p-3 ${
                  selected === p.key ? 'bg-green-50' : ''
                }`}
              >
                <strong>{p.name}</strong>
                <span className="block text-sm">
                  {p.service === 'vtc' ? 'VTC' : 'Livraison'} · {p.vehicle} ·{' '}
                  {p.city_label}
                </span>
                <span
                  className="block text-sm"
                  style={{ color: colors[fresh(p, now) ? p.state : 'stale'] }}
                >
                  {labels[p.state]} ·{' '}
                  {fresh(p, now) ? 'GPS récent' : 'GPS ancien ou absent'}
                </span>
                <small>
                  Dernière position :{' '}
                  {p.position.updated_at
                    ? new Date(p.position.updated_at).toLocaleString('fr-FR')
                    : 'Non reçue'}
                </small>
              </button>
            ))}
          </section>
        </div>
      )}
      {detail && (
        <section className="panel p-5">
          <h2 className="font-bold">{detail.name}</h2>
          <Link
            className="text-blue-700 underline"
            href={
              detail.service === 'vtc'
                ? `/drivers/${detail.id}`
                : `/delivery-drivers/${detail.id}`
            }
          >
            Ouvrir le dossier partenaire
          </Link>
          {jobs
            .filter((j) => detail.jobs.includes(j.key))
            .map((j) => (
              <div key={j.key} className="mt-3">
                <strong>
                  {j.service === 'vtc' ? 'Course' : 'Livraison'} #{j.id} ·{' '}
                  {jobLabels[j.status] || j.status}
                </strong>
                <p>
                  {j.pickup_label} → {j.dropoff_label}
                </p>
              </div>
            ))}
        </section>
      )}
      <section className="panel p-5">
        <h2 className="font-bold">Prestations actives · {jobs.length}</h2>
        {jobs.length === 0 ? (
          <p>Aucune prestation active dans ce périmètre.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Ville</th>
                  <th>Trajet</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.key} className="border-t">
                    <td className="p-2">
                      {j.service === 'vtc' ? 'VTC' : 'Livraison'} #{j.id}
                    </td>
                    <td>{j.city_label}</td>
                    <td>
                      {j.pickup_label} → {j.dropoff_label}
                    </td>
                    <td>{jobLabels[j.status] || j.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
