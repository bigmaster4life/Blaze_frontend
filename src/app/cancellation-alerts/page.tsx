'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { usePollingTask } from '@/hooks/usePollingTask';
import api, { apiErrorMessage } from '@/utils/api';
const statuses: Record<string, string> = {
  open: 'À examiner',
  reviewing: 'En cours d’examen',
  dismissed: 'Classée sans suite',
  action_required: 'Action à organiser',
  resolved: 'Dossier clôturé',
};
type RecordData = {
  id: number;
  service: string;
  job_id: number;
  client_id: number | null;
  partner_id: number | null;
  reason_label: string;
  note: string;
  status_before: string;
  created_at: string;
  context: Record<string, number>;
};
type Alert = {
  id: number;
  record: RecordData;
  score: number;
  signals: { code: string; label: string; points: number }[];
  metrics: Record<string, number | string | null>;
  status: string;
  version: number;
  created_at: string;
  partner_name: string;
  partner_path: string | null;
  reviews?: {
    id: number;
    reviewer_id: number | null;
    previous_status: string;
    status: string;
    note: string;
    created_at: string;
  }[];
  related_records?: RecordData[];
};
type Page = {
  count: number;
  results: Alert[];
  pending_analysis: number;
  legacy_last_30_days: number;
};
export default function CancellationAlerts() {
  const { user } = useAuth();
  const allowed =
    !!user &&
    !!(
      user.is_superuser ||
      (user.is_staff && user.user_type === 'manager_staff')
    );
  const [status, setStatus] = useState('open'),
    [service, setService] = useState('all'),
    [page, setPage] = useState(1),
    [data, setData] = useState<Page | null>(null),
    [error, setError] = useState(''),
    [detail, setDetail] = useState<Alert | null>(null),
    [decision, setDecision] = useState('reviewing'),
    [note, setNote] = useState(''),
    [saving, setSaving] = useState(false),
    [detailError, setDetailError] = useState(''),
    [notice, setNotice] = useState('');
  const alive = useRef(true);
  const detailRun = useRef(0);
  const listRun = useRef(0);
  const listBusy = useRef(false);
  const [updated, setUpdated] = useState<string | null>(null);
  useEffect(() => {
    alive.current = true;
    const details = detailRun;
    const lists = listRun;
    return () => {
      alive.current = false;
      details.current++;
      lists.current++;
    };
  }, []);
  const load = useCallback(async () => {
    const run = ++listRun.current;
    try {
      const { data: d } = await api.get<Page>('/cancellation-alerts/', {
        params: { status, service, page },
      });
      if (!alive.current || run !== listRun.current) return;
      setData(d);
      setError('');
      setUpdated(new Date().toLocaleTimeString('fr-FR'));
    } catch (e) {
      if (alive.current && run === listRun.current)
        setError(apiErrorMessage(e));
    }
  }, [status, service, page]);
  usePollingTask(load, allowed, 10000, `${status}:${service}:${page}`);
  const open = async (id: number) => {
    const run = ++detailRun.current;
    setDetail(null);
    setDetailError('');
    setNotice('');
    setNote('');
    try {
      const { data: d } = await api.get<Alert>(`/cancellation-alerts/${id}/`);
      if (!alive.current || run !== detailRun.current) return;
      setDetail(d);
      setDecision(d.status);
    } catch (e) {
      if (alive.current && run === detailRun.current)
        setDetailError(apiErrorMessage(e));
    }
  };
  const save = async () => {
    if (!detail || saving || listBusy.current) return;
    listBusy.current = true;
    setSaving(true);
    setDetailError('');
    try {
      await api.patch(`/cancellation-alerts/${detail.id}/`, {
        status: decision,
        note: note.trim(),
        version: detail.version,
      });
      if (!alive.current) return;
      await open(detail.id);
      await load();
      setNotice(
        'Décision enregistrée. Aucun message ni blocage de compte n’a été déclenché.'
      );
    } catch (e) {
      if (alive.current) setDetailError(apiErrorMessage(e));
    } finally {
      listBusy.current = false;
      if (alive.current) setSaving(false);
    }
  };
  if (!allowed)
    return (
      <section className="panel p-5">
        <h1>Accès réservé</h1>
        <p>Ces dossiers sont réservés aux gestionnaires et administrateurs.</p>
      </section>
    );
  return (
    <div className="space-y-5">
      <section className="panel p-5">
        <h1 className="text-2xl font-bold">Annulations à examiner</h1>
        <p className="mt-2">
          Les indices orientent une vérification humaine. Un score ne prouve pas
          une fraude et ne déclenche aucune sanction.
        </p>
        <p className="text-sm text-gray-600 mt-2">
          Les motifs et commentaires sont confidentiels. Vérifiez le contexte et
          échangez avec les personnes concernées avant toute décision.
        </p>
        <Link className="text-green-800 underline" href="/supervision">
          Ouvrir la supervision
        </Link>
      </section>
      <section className="flex flex-wrap gap-4 items-end">
        <label className="flex flex-col gap-1">
          Statut
          <select
            aria-label="Statut des alertes"
            className="border rounded-lg p-2 bg-white"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
              setData(null);
            }}
          >
            <option value="all">Tous les dossiers</option>
            {Object.entries(statuses).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Service
          <select
            aria-label="Service des alertes"
            className="border rounded-lg p-2 bg-white"
            value={service}
            onChange={(e) => {
              setService(e.target.value);
              setPage(1);
              setData(null);
            }}
          >
            <option value="all">VTC et livraison</option>
            <option value="vtc">VTC</option>
            <option value="delivery">Livraison</option>
          </select>
        </label>
        <p className="text-sm text-gray-600">
          {data?.count ?? '—'} dossier(s) · Dernière mise à jour :{' '}
          {updated || 'en attente'}
        </p>
      </section>
      {error && (
        <div role="alert" className="notice-error">
          {error} <button onClick={() => void load()}>Réessayer</button>
        </div>
      )}
      {!!data?.pending_analysis && (
        <p role="status">
          {data.pending_analysis} annulation(s) en attente d’analyse. Le
          traitement reprend automatiquement.
        </p>
      )}
      {!!data?.legacy_last_30_days && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm">
          {data.legacy_last_30_days} annulation(s) sans motif sur 30 jours : les
          anciennes applications doivent être mises à jour. Ces cas ne sont pas
          interprétés comme des signalements.
        </p>
      )}
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <section className="panel p-4">
          <h2 className="text-lg font-bold">Dossiers</h2>
          {!data && !error && <p role="status">Chargement…</p>}
          {data?.results.length === 0 && (
            <p className="py-5">Aucune alerte dans ce périmètre.</p>
          )}
          {data?.results.map((a) => (
            <button
              key={a.id}
              disabled={saving}
              onClick={() => void open(a.id)}
              className={`block w-full text-left p-4 border-b ${
                detail?.id === a.id ? 'bg-green-50' : ''
              }`}
            >
              <div className="flex justify-between gap-3">
                <strong>{a.partner_name}</strong>
                <span
                  className={`rounded-full px-3 py-1 text-sm ${
                    a.score >= 70
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  Priorité {a.score >= 70 ? 'haute' : 'modérée'} · {a.score}/100
                </span>
              </div>
              <p>
                {a.record.service === 'vtc' ? 'Course' : 'Livraison'} #
                {a.record.job_id} · {a.record.reason_label}
              </p>
              <small>
                {new Date(a.record.created_at).toLocaleString('fr-FR')} ·{' '}
                {statuses[a.status] || a.status}
              </small>
            </button>
          ))}
          <div className="flex items-center justify-between mt-4">
            <button
              disabled={page <= 1}
              className="button-quiet"
              onClick={() => {
                setPage(page - 1);
                setData(null);
              }}
            >
              Précédent
            </button>
            <span>Page {page}</span>
            <button
              disabled={!data || page * 25 >= data.count}
              className="button-quiet"
              onClick={() => {
                setPage(page + 1);
                setData(null);
              }}
            >
              Suivant
            </button>
          </div>
        </section>
        <section className="panel p-5">
          <h2 className="text-lg font-bold">Examen du dossier</h2>
          {detailError && (
            <p role="alert" className="notice-error">
              {detailError} En cas de conflit, rechargez le dossier avant de
              réessayer.
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-lg bg-green-50 p-3">
              {notice}
            </p>
          )}
          {!detail ? (
            <p className="mt-3">
              Sélectionnez une alerte pour consulter les indices et son
              historique.
            </p>
          ) : (
            <>
              <h3 className="font-bold mt-4">{detail.partner_name}</h3>
              {detail.partner_path && (
                <Link
                  className="underline text-green-800"
                  href={detail.partner_path}
                >
                  Dossier partenaire
                </Link>
              )}
              <p className="mt-2">
                Client #{detail.record.client_id ?? 'non renseigné'} ·{' '}
                {detail.record.service === 'vtc' ? 'Course' : 'Livraison'} #
                {detail.record.job_id}
              </p>
              <p>{detail.record.reason_label}</p>
              {detail.record.note && (
                <blockquote className="border-l-4 border-gray-200 pl-3 my-3 whitespace-pre-wrap">
                  {detail.record.note}
                </blockquote>
              )}
              <h3 className="font-bold mt-4">Indices observés</h3>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                {detail.signals.map((s) => (
                  <li key={s.code}>
                    {s.label}{' '}
                    <span className="text-gray-500">(+{s.points})</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 mt-2">
                Règles {detail.metrics.rule_version} · fenêtre de 30 jours ·
                score plafonné à 100.
              </p>
              <h3 className="font-bold mt-5">Suivi de la vérification</h3>
              <label className="block mt-2">
                Décision
                <select
                  aria-label="Décision du dossier"
                  disabled={saving}
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  className="block border rounded-lg p-2 w-full"
                >
                  {Object.entries(statuses).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block mt-3">
                Justification obligatoire
                <textarea
                  maxLength={1000}
                  disabled={saving}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="block border rounded-lg p-3 w-full min-h-24"
                  placeholder="Décrivez les vérifications et la suite convenue."
                />
              </label>
              <button
                className="button-primary mt-3"
                disabled={saving || note.trim().length < 3}
                onClick={() => void save()}
              >
                {saving ? 'Enregistrement…' : 'Enregistrer le suivi'}
              </button>
              <p className="text-sm text-gray-600 mt-2">
                Aucun avertissement n’est envoyé et aucun compte n’est suspendu
                depuis cet écran. Toute mesure doit être vérifiée et organisée
                par un responsable.
              </p>
              <h3 className="font-bold mt-5">Historique des décisions</h3>
              {!detail.reviews?.length && <p>Aucune décision enregistrée.</p>}
              {detail.reviews?.map((r) => (
                <div key={r.id} className="border-t py-3">
                  <strong>{statuses[r.status] || r.status}</strong>
                  <small className="block">
                    {new Date(r.created_at).toLocaleString('fr-FR')} ·
                    Responsable #{r.reviewer_id ?? 'supprimé'}
                  </small>
                  <p className="whitespace-pre-wrap">{r.note}</p>
                </div>
              ))}
              <h3 className="font-bold mt-5">
                Autres annulations récentes du partenaire
              </h3>
              {detail.related_records?.map((r) => (
                <div key={r.id} className="border-t py-2 text-sm">
                  {r.service === 'vtc' ? 'VTC' : 'Livraison'} #{r.job_id} ·
                  Client #{r.client_id ?? '—'} · {r.reason_label}
                  <small className="block">
                    {new Date(r.created_at).toLocaleString('fr-FR')}
                  </small>
                </div>
              ))}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
