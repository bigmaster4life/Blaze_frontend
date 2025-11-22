'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { isAxiosError } from 'axios';
import api from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';

type DriverCategory = 'eco' | 'clim' | 'vip';

interface DriverRow {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  vehicle_plate?: string;
  category?: DriverCategory;
  role?: string;
  must_reset_password?: boolean;
  onboarding_completed?: boolean;
  created_at?: string;
  is_blocked?: boolean;
  block_reason?: string;
}

export default function DriversPage() {
  const { user } = useAuth();

  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    plate_number: '',
    category: '' as '' | DriverCategory,
  });

  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // chargement par chauffeur pour renvoi d’invitation
  const [resendLoadingMap, setResendLoadingMap] = useState<Record<number, boolean>>({});
  // chargement par chauffeur pour blocage/déblocage
  const [blockLoadingMap, setBlockLoadingMap] = useState<Record<number, boolean>>({});

  const isManager = user?.user_type === 'manager_staff';
  const isEmployee = user?.user_type === 'employee_staff';

  const fetchDrivers = async () => {
    try {
      const response = await api.get<DriverRow[]>('/drivers/');
      setDrivers(response.data || []);
      setError(null);
    } catch (err: unknown) {
      if (isAxiosError(err)) {
        const msg =
          typeof err.response?.data === 'string'
            ? err.response.data
            : 'Erreur lors du chargement des chauffeurs';
        setError(msg);
      } else {
        setError('Erreur lors du chargement des chauffeurs');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isManager || isEmployee) {
      fetchDrivers();
      const interval = setInterval(fetchDrivers, 30000);
      return () => clearInterval(interval);
    }
  }, [isManager, isEmployee]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSuccess(null);
    setFormError(null);

    if (!formData.category) {
      setFormError('Veuillez sélectionner une catégorie (Éco / Climatisé / VIP).');
      return;
    }

    try {
      const payload = {
        full_name: `${formData.first_name} ${formData.last_name}`.trim(),
        email: formData.email,
        phone: formData.phone,
        vehicle_plate: formData.plate_number,
        category: formData.category as DriverCategory,
        role: 'chauffeur',
      };

      await api.post('/drivers/invite/', payload);

      setFormSuccess('Chauffeur ajouté et invité avec succès (mail envoyé).');
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        plate_number: '',
        category: '',
      });

      if (isManager) fetchDrivers();
    } catch (err: unknown) {
      let detail = "Erreur lors de l'ajout du chauffeur";
      if (isAxiosError(err)) {
        const d = err.response?.data;
        if (typeof d === 'string') detail = d;
        else if (d && typeof d === 'object') detail = JSON.stringify(d);
      }
      setFormError(detail);
    }
  };

  const resendInvite = async (driverId: number) => {
    setFormSuccess(null);
    setFormError(null);

    setResendLoadingMap((m) => ({ ...m, [driverId]: true }));
    try {
      const { data } = await api.post<{ detail?: string; email_sent?: boolean; email_error?: string }>(
        `/drivers/${driverId}/resend-invite/`
      );

      const detail = data?.detail || 'Invitation renvoyée.';
      const suffix =
        data?.email_sent === false && data?.email_error
          ? ` (Email non envoyé: ${data.email_error})`
          : '';
      setFormSuccess(`${detail}${suffix}`);
    } catch (err: unknown) {
      let detail = "Échec du renvoi de l'invitation";
      if (isAxiosError(err)) {
        const d = err.response?.data;
        if (typeof d === 'string') detail = d;
        else if (d && typeof d === 'object') detail = JSON.stringify(d);
      }
      setFormError(detail);
    } finally {
      setResendLoadingMap((m) => {
        const rest = { ...m };
        delete rest[driverId];
        return rest;
      });
    }
  };

  const toggleBlock = async (driver: DriverRow) => {
    setFormSuccess(null);
    setFormError(null);

    const currentlyBlocked = !!driver.is_blocked;
    let reason = driver.block_reason || '';

    // Si on bloque, demander un motif
    if (!currentlyBlocked) {
      const input = window.prompt('Motif du blocage (obligatoire) :', reason);
      if (!input || !input.trim()) {
        return;
      }
      reason = input.trim();
    }

    setBlockLoadingMap((m) => ({ ...m, [driver.id]: true }));

    try {
      await api.post(`/drivers/${driver.id}/block/`, {
        is_blocked: !currentlyBlocked,
        block_reason: currentlyBlocked ? '' : reason,
      });

      setDrivers((prev) =>
        prev.map((d) =>
          d.id === driver.id
            ? {
                ...d,
                is_blocked: !currentlyBlocked,
                block_reason: currentlyBlocked ? '' : reason,
              }
            : d
        )
      );

      setFormSuccess(
        !currentlyBlocked ? 'Chauffeur bloqué.' : 'Chauffeur débloqué.'
      );
    } catch (err: unknown) {
      let detail = "Erreur lors de la mise à jour du statut du chauffeur";
      if (isAxiosError(err)) {
        const d = err.response?.data;
        if (typeof d === 'string') detail = d;
        else if (d && typeof d === 'object') detail = JSON.stringify(d);
      }
      setFormError(detail);
    } finally {
      setBlockLoadingMap((m) => {
        const rest = { ...m };
        delete rest[driver.id];
        return rest;
      });
    }
  };

  if (!user || (!isManager && !isEmployee)) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-red-600 text-lg font-semibold">
          {"Accès refusé – vous n'avez pas les droits nécessaires."}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link
        href="/dashboard"
        className="mb-6 inline-block bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
      >
        ← Retour au tableau de bord
      </Link>

      <h1 className="text-3xl font-bold mb-4">Enrôlement d’un chauffeur</h1>

      <form onSubmit={handleSubmit} className="space-y-4 mb-10 max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            name="first_name"
            placeholder="Prénom"
            value={formData.first_name}
            onChange={handleChange}
            required
            className="border px-4 py-2 rounded w-full"
          />
          <input
            type="text"
            name="last_name"
            placeholder="Nom"
            value={formData.last_name}
            onChange={handleChange}
            required
            className="border px-4 py-2 rounded w-full"
          />
        </div>

        <input
          type="email"
          name="email"
          placeholder="Adresse email"
          value={formData.email}
          onChange={handleChange}
          required
          className="border px-4 py-2 rounded w-full"
        />

        <input
          type="text"
          name="phone"
          placeholder="Numéro de téléphone"
          value={formData.phone}
          onChange={handleChange}
          required
          className="border px-4 py-2 rounded w-full"
        />

        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            name="plate_number"
            placeholder="Plaque d'immatriculation"
            value={formData.plate_number}
            onChange={handleChange}
            required
            className="border px-4 py-2 rounded w-full"
          />

          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
            className="border px-4 py-2 rounded w-full bg-white"
          >
            <option value="">— Catégorie —</option>
            <option value="eco">Éco</option>
            <option value="clim">Climatisé</option>
            <option value="vip">VIP</option>
          </select>
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          Enregistrer & envoyer l’invitation
        </button>

        {formSuccess && <p className="text-green-600 mt-2">{formSuccess}</p>}
        {formError && <p className="text-red-600 mt-2">{formError}</p>}
      </form>

      {isManager && (
        <>
          <h2 className="text-2xl font-bold mb-4">Liste des chauffeurs</h2>
          {loading ? (
            <p>Chargement...</p>
          ) : error ? (
            <p className="text-red-600">{error}</p>
          ) : drivers.length === 0 ? (
            <p>Aucun chauffeur pour le moment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border rounded text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Nom</th>
                    <th className="p-2 text-left">Email</th>
                    <th className="p-2 text-left">Téléphone</th>
                    <th className="p-2 text-left">Plaque</th>
                    <th className="p-2 text-left">Catégorie</th>
                    <th className="p-2 text-left">Créé le</th>
                    <th className="p-2 text-left">Onboarding</th>
                    <th className="p-2 text-left">Statut</th>
                    <th className="p-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d) => {
                    const isSending = !!resendLoadingMap[d.id];
                    const isBlocking = !!blockLoadingMap[d.id];

                    return (
                      <tr key={d.id} className="border-t">
                        <td className="p-2">{d.full_name || '—'}</td>
                        <td className="p-2">{d.email}</td>
                        <td className="p-2">{d.phone}</td>
                        <td className="p-2">{d.vehicle_plate || '—'}</td>
                        <td className="p-2 uppercase">{d.category || '—'}</td>
                        <td className="p-2">
                          {d.created_at ? new Date(d.created_at).toLocaleString() : '—'}
                        </td>
                        <td className="p-2">
                          {d.onboarding_completed ? (
                            <span className="text-green-700 font-semibold">OK</span>
                          ) : (
                            <span className="text-yellow-700 font-semibold">En attente</span>
                          )}
                        </td>
                        <td className="p-2">
                          {d.is_blocked ? (
                            <span className="text-red-700 font-semibold">
                              Bloqué
                              {d.block_reason ? ` (${d.block_reason})` : ''}
                            </span>
                          ) : (
                            <span className="text-green-700 font-semibold">Actif</span>
                          )}
                        </td>
                        <td className="p-2 flex items-center gap-2">
                          <Link
                            href={`/drivers/${d.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            Voir
                          </Link>

                          <button
                            type="button"
                            onClick={() => resendInvite(d.id)}
                            disabled={isSending}
                            className={`text-white px-3 py-1 rounded transition ${
                              isSending
                                ? 'bg-indigo-300 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                            title="Renvoyer l’invitation (régénère un mot de passe temporaire)"
                          >
                            {isSending ? 'Envoi…' : 'Renvoyer invitation'}
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleBlock(d)}
                            disabled={isBlocking}
                            className={`text-white px-3 py-1 rounded transition ${
                              d.is_blocked
                                ? 'bg-green-600 hover:bg-green-700'
                                : 'bg-red-600 hover:bg-red-700'
                            } ${isBlocking ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            {isBlocking
                              ? '...'
                              : d.is_blocked
                              ? 'Débloquer'
                              : 'Bloquer'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}