'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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

  useEffect(() => {
    if (!id) return;

    const fetchDriver = async () => {
      try {
        const res = await api.get<DriverDetail>(`/drivers/${id}/`);
        setDriver(res.data);
        setErr(null);
      } catch {
        setErr('Impossible de charger les détails du chauffeur.');
      } finally {
        setLoading(false);
      }
    };

    fetchDriver();
  }, [id]);

  if (loading) {
    return <p className="px-4 py-8">Chargement...</p>;
  }

  if (err) {
    return (
      <p className="px-4 py-8 text-red-600">
        {err}
      </p>
    );
  }

  if (!driver) {
    return (
      <p className="px-4 py-8">
        Aucun chauffeur trouvé.
      </p>
    );
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

      {/* Bloc identité */}
      <section className="bg-white rounded-xl shadow p-4 space-y-2">
        <h2 className="text-lg font-semibold mb-2">Identité</h2>
        <p><span className="font-medium">Email :</span> {email}</p>
        <p><span className="font-medium">Téléphone :</span> {phone}</p>
        <p><span className="font-medium">Catégorie :</span> {category || '—'}</p>
      </section>

      {/* Bloc véhicule */}
      <section className="bg-white rounded-xl shadow p-4 space-y-2">
        <h2 className="text-lg font-semibold mb-2">Véhicule</h2>
        <p>
          <span className="font-medium">Plaque :</span>{' '}
          {vehicle_plate || '—'}
        </p>
      </section>

      {/* Bloc statut & onboarding */}
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

      {/* Bloc documents */}
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