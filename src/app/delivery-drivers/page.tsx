'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { isAxiosError } from 'axios';
import api from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';

type City = 'libreville' | 'owendo' | 'angondje' | 'port_gentil' | 'franceville';
type VehicleType = 'moto' | 'car' | 'van';

type ApiErrorDetail = {
  detail?: string;
};

interface DeliveryDriverRow {
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
  created_at?: string;
  updated_at?: string;
}

function normalizePhoneUI(raw: string): string {
  const s = (raw || '').replace(/\s+/g, '').replace(/[^\d+]/g, '');
  if (!s) return '';
  if (s.startsWith('241') && s.length >= 11) return s;
  if (s.startsWith('0')) return `241${s.slice(1)}`;
  return s;
}

export default function DeliveryDriversPage() {
  const { user } = useAuth();

  const isAllowed = useMemo(() => {
    const t = user?.user_type;
    return t === 'admin' || t === 'manager_staff' || t === 'employee_staff' || t === 'staff';
  }, [user?.user_type]);

  const [drivers, setDrivers] = useState<DeliveryDriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    city: 'libreville' as City,
    vehicle_type: 'moto' as VehicleType,
  });

  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [resendLoadingMap, setResendLoadingMap] = useState<Record<number, boolean>>({});
  const [blockLoadingMap, setBlockLoadingMap] = useState<Record<number, boolean>>({});
  const [validateLoadingMap, setValidateLoadingMap] = useState<Record<number, boolean>>({});

  const fetchDrivers = async () => {
    try {
      const { data } = await api.get<DeliveryDriverRow[]>('/delivery/admin/drivers/');
      setDrivers(data || []);
      setListError(null);
    } catch (err: unknown) {
      if (isAxiosError(err)) {
        const d = err.response?.data as ApiErrorDetail;
        setListError(d?.detail || 'Erreur lors du chargement des livreurs');
      } else {
        setListError('Erreur lors du chargement des livreurs');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAllowed) return;
    fetchDrivers();
    const i = setInterval(fetchDrivers, 30000);
    return () => clearInterval(i);
  }, [isAllowed]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSuccess(null);
    setFormError(null);

    if (!formData.full_name.trim()) {
      setFormError('Nom du livreur requis.');
      return;
    }
    if (!formData.phone.trim()) {
      setFormError('Téléphone requis.');
      return;
    }

    try {
      const payload = {
        full_name: formData.full_name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim(),
        city: formData.city,
        vehicle_type: formData.vehicle_type,
      };

      // ✅ Backend réel: /delivery/drivers/create/
      await api.post('/delivery/drivers/create/', payload);

      setFormSuccess('Livreur créé. Invitation envoyée.');
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        city: 'libreville',
        vehicle_type: 'moto',
      });

      await fetchDrivers();
    } catch (err: unknown) {
      let detail = 'Erreur lors de la création du livreur';
      if (isAxiosError(err)) {
        const d = err.response?.data as ApiErrorDetail;
        detail = d?.detail || detail;
      }
      setFormError(detail);
    }
  };

  const resendInvite = async (driverId: number) => {
    setFormSuccess(null);
    setFormError(null);

    setResendLoadingMap((m) => ({ ...m, [driverId]: true }));
    try {
      const { data } = await api.post<ApiErrorDetail>(
        // ✅ Backend réel: /resend_invite/
        `/delivery/admin/drivers/${driverId}/resend_invite/`
      );
      setFormSuccess(data?.detail || 'Invitation renvoyée.');
    } catch (err: unknown) {
      let detail = "Échec du renvoi de l'invitation";
      if (isAxiosError(err)) {
        const d = err.response?.data as ApiErrorDetail;
        detail = d?.detail || detail;
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

  const toggleBlock = async (driver: DeliveryDriverRow) => {
    setFormSuccess(null);
    setFormError(null);

    const currentlyBlocked = !!driver.is_blocked;
    let reason = driver.block_reason || '';

    if (!currentlyBlocked) {
      const input = window.prompt('Motif du blocage (obligatoire) :', reason);
      if (!input || !input.trim()) return;
      reason = input.trim();
    }

    setBlockLoadingMap((m) => ({ ...m, [driver.id]: true }));

    try {
      await api.post(
        // ✅ Backend réel: /toggle_block/
        `/delivery/admin/drivers/${driver.id}/toggle_block/`,
        {
          is_blocked: !currentlyBlocked,
          block_reason: currentlyBlocked ? '' : reason,
        }
      );

      setDrivers((prev) =>
        prev.map((d) =>
          d.id === driver.id
            ? {
                ...d,
                is_blocked: !currentlyBlocked,
                block_reason: currentlyBlocked ? '' : reason,
                is_active: currentlyBlocked ? d.is_active : false,
              }
            : d
        )
      );

      setFormSuccess(!currentlyBlocked ? 'Livreur bloqué.' : 'Livreur débloqué.');
    } catch (err: unknown) {
      let detail = 'Erreur lors de la mise à jour du statut du livreur';
      if (isAxiosError(err)) {
        const d = err.response?.data as ApiErrorDetail;
        detail = d?.detail || detail;
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

  const validateDriver = async (driverId: number) => {
    setFormSuccess(null);
    setFormError(null);

    setValidateLoadingMap((m) => ({ ...m, [driverId]: true }));
    try {
      await api.post(
        // ✅ Backend réel: /validate_driver/
        `/delivery/admin/drivers/${driverId}/validate_driver/`
      );

      setDrivers((prev) =>
        prev.map((d) =>
          d.id === driverId
            ? {
                ...d,
                is_verified: true,
                is_active: true,
              }
            : d
        )
      );

      setFormSuccess('Livreur validé.');
    } catch (err: unknown) {
      let detail = 'Erreur lors de la validation du livreur';
      if (isAxiosError(err)) {
        const d = err.response?.data as ApiErrorDetail;
        detail = d?.detail || detail;
      }
      setFormError(detail);
    } finally {
      setValidateLoadingMap((m) => {
        const rest = { ...m };
        delete rest[driverId];
        return rest;
      });
    }
  };

  if (!user || !isAllowed) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-red-600 text-lg font-semibold">
          Accès refusé – vous n&apos;avez pas les droits nécessaires.
        </p>
      </div>
    );
  }

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

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link
        href="/dashboard"
        className="mb-6 inline-block bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
      >
        ← Retour
      </Link>

      <h1 className="text-3xl font-bold mb-4">Enrôlement des livreurs</h1>

      <form onSubmit={handleSubmit} className="space-y-4 mb-10 max-w-2xl">
        <input
          type="text"
          name="full_name"
          placeholder="Nom complet"
          value={formData.full_name}
          onChange={handleChange}
          required
          className="border px-4 py-2 rounded w-full"
        />
        <input
          type="email"
          name="email"
          placeholder="Email (optionnel)"
          value={formData.email}
          onChange={handleChange}
          className="border px-4 py-2 rounded w-full"
        />
        <input
          type="text"
          name="phone"
          placeholder="Téléphone"
          value={formData.phone}
          onChange={handleChange}
          required
          className="border px-4 py-2 rounded w-full"
        />

        <div className="grid grid-cols-2 gap-4">
          <select
            name="city"
            value={formData.city}
            onChange={handleChange}
            className="border px-4 py-2 rounded w-full bg-white"
          >
            <option value="libreville">Libreville</option>
            <option value="owendo">Owendo</option>
            <option value="angondje">Angondjé</option>
            <option value="port_gentil">Port-Gentil</option>
            <option value="franceville">Franceville</option>
          </select>

          <select
            name="vehicle_type"
            value={formData.vehicle_type}
            onChange={handleChange}
            className="border px-4 py-2 rounded w-full bg-white"
          >
            <option value="moto">Moto</option>
            <option value="car">Voiture</option>
            <option value="van">Van</option>
          </select>
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          Créer le livreur
        </button>

        {formSuccess && <p className="text-green-600">{formSuccess}</p>}
        {formError && <p className="text-red-600">{formError}</p>}
      </form>

      <h2 className="text-2xl font-bold mb-4">Liste des livreurs</h2>

      {loading ? (
        <p>Chargement…</p>
      ) : listError ? (
        <p className="text-red-600">{listError}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border rounded text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Nom</th>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Téléphone</th>
                <th className="p-2 text-left">Ville</th>
                <th className="p-2 text-left">Véhicule</th>
                <th className="p-2 text-left">Onboarding</th>
                <th className="p-2 text-left">Statut</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => {
                const phoneDisplay = normalizePhoneUI(d.phone);
                const isBlocked = !!d.is_blocked;
                const isResending = !!resendLoadingMap[d.id];
                const isBlocking = !!blockLoadingMap[d.id];
                const isValidating = !!validateLoadingMap[d.id];

                return (
                  <tr key={d.id} className="border-t">
                    <td className="p-2">{d.full_name}</td>
                    <td className="p-2">{d.email || '—'}</td>
                    <td className="p-2">{phoneDisplay}</td>
                    <td className="p-2">{cityLabel[d.city]}</td>
                    <td className="p-2">{vehicleLabel[d.vehicle_type]}</td>
                    <td className="p-2">
                      {d.onboarding_completed ? 'OK' : 'En attente'}
                    </td>
                    <td className="p-2">
                      {isBlocked ? 'Bloqué' : d.is_active ? 'Actif' : 'Inactif'}
                      {d.is_verified ? ' (Vérifié)' : ''}
                    </td>

                    <td className="p-2 flex gap-2">
                      <Link
                        href={`/delivery-drivers/${d.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        Voir
                      </Link>

                      <button
                        onClick={() => resendInvite(d.id)}
                        disabled={isResending}
                        className={`px-3 py-1 rounded text-white ${
                          isResending
                            ? 'bg-indigo-300 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        {isResending ? 'Envoi…' : 'Renvoyer'}
                      </button>

                      <button
                        onClick={() => toggleBlock(d)}
                        disabled={isBlocking}
                        className={`px-3 py-1 rounded text-white ${
                          isBlocked
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-red-600 hover:bg-red-700'
                        } ${isBlocking ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        {isBlocking ? '...' : isBlocked ? 'Débloquer' : 'Bloquer'}
                      </button>

                      <button
                        onClick={() => validateDriver(d.id)}
                        disabled={isValidating || !!d.is_verified}
                        className={`px-3 py-1 rounded text-white ${
                          d.is_verified
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700'
                        } ${isValidating ? 'opacity-60 cursor-not-allowed' : ''}`}
                        title={d.is_verified ? 'Déjà validé' : 'Valider le livreur'}
                      >
                        {isValidating ? '...' : d.is_verified ? 'Validé' : 'Valider'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}