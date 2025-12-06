'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/utils/api';

type DriverCategory = 'eco' | 'clim' | 'vip' | string;

interface DriverDetail {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  vehicle_plate?: string | null;
  category?: DriverCategory;
  onboarding_completed?: boolean;
  is_blocked?: boolean;
  block_reason?: string;
  license_file?: string | null;
  id_card_file?: string | null;
  insurance_file?: string | null;
  created_at?: string | null;
}

export default function DriverDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [driver, setDriver] = useState<DriverDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const fetchDriver = useCallback(async () => {
    if (!id) return;

    try {
      const res = await api.get<DriverDetail>(`/drivers/${id}/`);
      setDriver(res.data);
      setErr(null);
    } catch {
      setErr('Impossible de charger les détails du chauffeur.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDriver();
  }, [fetchDriver]);

  const validateDriver = async () => {
    if (!id) return;

    setActionLoading(true);
    setActionMsg(null);
    setActionErr(null);

    try {
      await api.patch(`/drivers/${id}/`, {
        onboarding_completed: true,
        must_reset_password: false,
      });

      setActionMsg('Chauffeur validé avec succès.');
      fetchDriver();
    } catch {
      setActionErr("Impossible de valider le chauffeur.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <p className="px-4 py-8">Chargement...</p>;
  }

  if (err) {
    return <p className="px-4 py-8 text-red-600">{err}</p>;
  }

  if (!driver) {
    return <p className="px-4 py-8">Aucun chauffeur trouvé.</p>;
  }

  const {
    full_name,
    email,
    phone,
    vehicle_plate,
    category,
    onboarding_completed,
    is_blocked,
    block_reason,
    license_file,
    id_card_file,
    insurance_file,
    created_at,
  } = driver;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/drivers"
          className="bg-gray-200 text-gray-900 px-4 py-2 rounded hover:bg-gray-300 transition"
        >
          ← Retour à la liste des chauffeurs
        </Link>

        <button
          onClick={validateDriver}
          disabled={actionLoading}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {actionLoading ? 'Validation...' : 'Valider manuellement'}
        </button>
      </div>

      {actionMsg && <p className="text-green-600">{actionMsg}</p>}
      {actionErr && <p className="text-red-600">{actionErr}</p>}

      <header>
        <h1 className="text-2xl font-bold mb-2">
          {full_name} — Détails du chauffeur
        </h1>
        {created_at && (
          <p className="text-sm text-gray-500">
            Créé le : {new Date(created_at).toLocaleString()}
          </p>
        )}
      </header>

      {/* Identité */}
      <section className="bg-white rounded-xl shadow p-4 space-y-2">
        <h2 className="text-lg font-semibold mb-2">Identité</h2>
        <p>
          <span className="font-medium">Email :</span> {email}
        </p>
        <p>
          <span className="font-medium">Téléphone :</span> {phone}
        </p>
        <p>
          <span className="font-medium">Catégorie :</span> {category || '—'}
        </p>
      </section>

      {/* Véhicule */}
      <section className="bg-white rounded-xl shadow p-4 space-y-2">
        <h2 className="text-lg font-semibold mb-2">Véhicule</h2>
        <p>
          <span className="font-medium">Plaque :</span> {vehicle_plate || '—'}
        </p>
      </section>

      {/* Statut & Onboarding */}
      <section className="bg-white rounded-xl shadow p-4 space-y-2">
        <h2 className="text-lg font-semibold mb-2">Statut & Onboarding</h2>
        <p>
          <span className="font-medium">Onboarding :</span>{' '}
          {onboarding_completed ? (
            <span className="text-green-700 font-semibold">Terminé</span>
          ) : (
            <span className="text-yellow-700 font-semibold">En attente</span>
          )}
        </p>
        <p>
          <span className="font-medium">Statut :</span>{' '}
          {is_blocked ? (
            <span className="text-red-700 font-semibold">Bloqué</span>
          ) : (
            <span className="text-green-700 font-semibold">Actif</span>
          )}
        </p>
        {is_blocked && block_reason && (
          <p className="text-sm text-red-600">
            <span className="font-medium">Motif :</span> {block_reason}
          </p>
        )}
      </section>

      {/* Documents */}
      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold mb-3">Documents</h2>
        <ul className="space-y-1 text-sm">
          <li>
            Permis :{' '}
            {license_file ? (
              <span className="text-green-700 font-semibold">✔️ Uploadé</span>
            ) : (
              <span className="text-red-700 font-semibold">❌ Manquant</span>
            )}
          </li>
          <li>
            Carte d&apos;identité :{' '}
            {id_card_file ? (
              <span className="text-green-700 font-semibold">✔️ Uploadée</span>
            ) : (
              <span className="text-red-700 font-semibold">❌ Manquante</span>
            )}
          </li>
          <li>
            Assurance :{' '}
            {insurance_file ? (
              <span className="text-green-700 font-semibold">✔️ Uploadée</span>
            ) : (
              <span className="text-red-700 font-semibold">❌ Manquante</span>
            )}
          </li>
        </ul>
      </section>
    </div>
  );
}