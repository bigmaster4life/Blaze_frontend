// app/delivery-drivers/[id]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { isAxiosError } from 'axios';
import api from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';

type City = 'libreville' | 'owendo' | 'angondje' | 'port_gentil' | 'franceville';
type VehicleType = 'moto' | 'car' | 'van';

type ApiErrorDetail = {
  detail?: string;
};

interface DriverDetail {
  id: number;
  full_name: string;
  email?: string | null;
  phone: string;
  city: City;
  vehicle_type: VehicleType;

  onboarding_completed: boolean;
  is_active: boolean;
  is_available?: boolean;
  is_verified?: boolean;

  is_blocked?: boolean;
  block_reason?: string | null;

  total_deliveries?: number;
  total_earnings?: string | number;

  created_at?: string;
  updated_at?: string;

  // aperçu documents (juste pour vérifier présence)
  identity_card?: string | null;
  driving_license?: string | null;
  photo?: string | null;
}

function normalizePhoneUI(raw: string): string {
  const s = (raw || '').replace(/\s+/g, '').replace(/[^\d+]/g, '');
  if (!s) return '';
  if (s.startsWith('241') && s.length >= 11) return s;
  if (s.startsWith('0')) return `241${s.slice(1)}`;
  return s;
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function DeliveryDriverDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user } = useAuth();

  const id = Number(params?.id);

  const isAllowed = useMemo(() => {
    const t = user?.user_type;
    return t === 'admin' || t === 'manager_staff' || t === 'employee_staff' || t === 'staff';
  }, [user?.user_type]);

  const [loading, setLoading] = useState(true);
  const [driver, setDriver] = useState<DriverDetail | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const [resendLoading, setResendLoading] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [validateLoading, setValidateLoading] = useState(false);

  const cityLabel: Record<City, string> = {
    libreville: 'Libreville',
    owendo: 'Owendo',
    angondje: 'Angondjé',
    port_gentil: 'Port-Gentil',
    franceville: 'Franceville',
  };

  const vehicleLabel: Record<VehicleType, string> = {
    moto: 'Moto',
    car: 'Voiture',
    van: 'Van',
  };

  const fetchDriver = async () => {
    if (!Number.isFinite(id)) return;
    setLoading(true);
    setErrMsg(null);
    try {
      // Option A: la page détail appelle un endpoint "retrieve" admin
      const { data } = await api.get<DriverDetail>(`/delivery/admin/drivers/${id}/`);
      setDriver(data);
    } catch (err: unknown) {
      if (isAxiosError(err)) {
        const d = err.response?.data as ApiErrorDetail;
        setErrMsg(d?.detail || `Livreur introuvable (id=${id}).`);
      } else {
        setErrMsg(`Livreur introuvable (id=${id}).`);
      }
      setDriver(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAllowed) return;
    if (!id || Number.isNaN(id)) {
      setErrMsg('ID invalide.');
      setLoading(false);
      return;
    }
    fetchDriver();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAllowed, id]);

  const resendInvite = async () => {
    if (!driver) return;
    setActionMsg(null);
    setActionErr(null);
    setResendLoading(true);
    try {
      const { data } = await api.post<ApiErrorDetail>(`/delivery/admin/drivers/${driver.id}/resend_invite/`);
      setActionMsg(data?.detail || 'Invitation renvoyée.');
      await fetchDriver();
    } catch (err: unknown) {
      let detail = "Échec du renvoi de l'invitation";
      if (isAxiosError(err)) {
        const d = err.response?.data as ApiErrorDetail;
        detail = d?.detail || detail;
      }
      setActionErr(detail);
    } finally {
      setResendLoading(false);
    }
  };

  const toggleBlock = async () => {
    if (!driver) return;
    setActionMsg(null);
    setActionErr(null);

    const currentlyBlocked = !!driver.is_blocked;
    let reason = driver.block_reason || '';

    if (!currentlyBlocked) {
      const input = window.prompt('Motif du blocage (obligatoire) :', reason);
      if (!input || !input.trim()) return;
      reason = input.trim();
    }

    setBlockLoading(true);
    try {
      await api.post(`/delivery/admin/drivers/${driver.id}/toggle_block/`, {
        is_blocked: !currentlyBlocked,
        block_reason: currentlyBlocked ? '' : reason,
      });

      setActionMsg(!currentlyBlocked ? 'Livreur bloqué.' : 'Livreur débloqué.');
      await fetchDriver();
    } catch (err: unknown) {
      let detail = 'Erreur lors de la mise à jour du statut du livreur';
      if (isAxiosError(err)) {
        const d = err.response?.data as ApiErrorDetail;
        detail = d?.detail || detail;
      }
      setActionErr(detail);
    } finally {
      setBlockLoading(false);
    }
  };

  const validateDriver = async () => {
    if (!driver) return;
    setActionMsg(null);
    setActionErr(null);
    setValidateLoading(true);
    try {
      await api.post(`/delivery/admin/drivers/${driver.id}/validate_driver/`);
      setActionMsg('Livreur validé.');
      await fetchDriver();
    } catch (err: unknown) {
      let detail = 'Erreur lors de la validation du livreur';
      if (isAxiosError(err)) {
        const d = err.response?.data as ApiErrorDetail;
        detail = d?.detail || detail;
      }
      setActionErr(detail);
    } finally {
      setValidateLoading(false);
    }
  };

  if (!user || !isAllowed) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center">
        <p className="text-red-600 text-lg font-semibold">
          Accès refusé – vous n&apos;avez pas les droits nécessaires.
        </p>
        <div className="mt-6">
          <Link href="/dashboard" className="inline-block bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300">
            ← Retour au dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <Link href="/delivery-drivers" className="inline-block mb-6 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300">
          ← Retour
        </Link>
        <p>Chargement…</p>
      </div>
    );
  }

  if (errMsg || !driver) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <Link href="/delivery-drivers" className="inline-block mb-6 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300">
          ← Retour
        </Link>

        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
          {errMsg || 'Livreur introuvable.'}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => router.refresh()}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Recharger
          </button>
        </div>
      </div>
    );
  }

  const isBlocked = !!driver.is_blocked;
  const phoneDisplay = normalizePhoneUI(driver.phone);

  const docFlag = (v?: string | null) => (v ? '✅' : '—');

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <Link href="/delivery-drivers" className="inline-block mb-6 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300">
        ← Retour
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">{driver.full_name}</h1>
          <p className="text-gray-600 mt-1">
            {driver.email || '—'} • {phoneDisplay}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={resendInvite}
            disabled={resendLoading}
            className={`px-4 py-2 rounded text-white ${resendLoading ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {resendLoading ? 'Envoi…' : 'Renvoyer invitation'}
          </button>

          <button
            onClick={toggleBlock}
            disabled={blockLoading}
            className={`px-4 py-2 rounded text-white ${blockLoading ? 'opacity-60 cursor-not-allowed' : ''} ${
              isBlocked ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {blockLoading ? '...' : isBlocked ? 'Débloquer' : 'Bloquer'}
          </button>

          <button
            onClick={validateDriver}
            disabled={validateLoading || !!driver.is_verified}
            className={`px-4 py-2 rounded text-white ${validateLoading ? 'opacity-60 cursor-not-allowed' : ''} ${
              driver.is_verified ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
            title={driver.is_verified ? 'Déjà validé' : 'Valider le livreur'}
          >
            {validateLoading ? '...' : driver.is_verified ? 'Validé' : 'Valider'}
          </button>
        </div>
      </div>

      {actionMsg && <div className="mb-4 bg-green-50 border border-green-200 rounded p-3 text-green-700">{actionMsg}</div>}
      {actionErr && <div className="mb-4 bg-red-50 border border-red-200 rounded p-3 text-red-700">{actionErr}</div>}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Infos */}
        <div className="md:col-span-2 bg-white border rounded p-5">
          <h2 className="text-xl font-bold mb-4">Informations</h2>

          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Email</div>
              <div className="font-medium">{driver.email || '—'}</div>
            </div>
            <div>
              <div className="text-gray-500">Téléphone</div>
              <div className="font-medium">{phoneDisplay}</div>
            </div>

            <div>
              <div className="text-gray-500">Ville</div>
              <div className="font-medium">{cityLabel[driver.city]}</div>
            </div>
            <div>
              <div className="text-gray-500">Véhicule</div>
              <div className="font-medium">{vehicleLabel[driver.vehicle_type]}</div>
            </div>

            <div>
              <div className="text-gray-500">Créé le</div>
              <div className="font-medium">{fmtDate(driver.created_at)}</div>
            </div>
            <div>
              <div className="text-gray-500">Mis à jour</div>
              <div className="font-medium">{fmtDate(driver.updated_at)}</div>
            </div>
          </div>

          <hr className="my-5" />

          <h3 className="font-bold mb-2">Aperçu documents</h3>
          <div className="text-sm grid sm:grid-cols-3 gap-3">
            <div className="bg-gray-50 border rounded p-3">
              <div className="text-gray-500">Carte d&apos;identité</div>
              <div className="text-lg">{docFlag(driver.identity_card)}</div>
            </div>
            <div className="bg-gray-50 border rounded p-3">
              <div className="text-gray-500">Permis</div>
              <div className="text-lg">{docFlag(driver.driving_license)}</div>
            </div>
            <div className="bg-gray-50 border rounded p-3">
              <div className="text-gray-500">Photo</div>
              <div className="text-lg">{docFlag(driver.photo)}</div>
            </div>
          </div>
        </div>

        {/* Statut + stats */}
        <div className="bg-white border rounded p-5">
          <h2 className="text-xl font-bold mb-4">Statut</h2>

          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Actif</span>
              <span className="font-medium">{driver.is_active ? '✅' : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Disponible</span>
              <span className="font-medium">{driver.is_available ? '✅' : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Vérifié</span>
              <span className="font-medium">{driver.is_verified ? '✅' : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Onboarding</span>
              <span className="font-medium">{driver.onboarding_completed ? '✅' : 'En attente'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Bloqué</span>
              <span className="font-medium">{isBlocked ? '🚫' : '—'}</span>
            </div>

            {isBlocked && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700 mt-2">
                <div className="font-semibold mb-1">Motif :</div>
                <div>{driver.block_reason || '—'}</div>
              </div>
            )}
          </div>

          <hr className="my-5" />

          <h2 className="text-xl font-bold mb-4">Stats</h2>
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Livraisons</span>
              <span className="font-medium">{driver.total_deliveries ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Gains</span>
              <span className="font-medium">{driver.total_earnings ?? 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}