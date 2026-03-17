'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/utils/api';
import Link from 'next/link';

type TabKey = 'overview' | 'vtc' | 'delivery' | 'rental';

type StatCard = {
  label: string;
  value: number;
  color: string;
};

type DeliveryOperatorRequest = {
  id: number;
  type: string;
  pickup_zone: string | null;
  dropoff_zone: string | null;
  pickup_label: string;
  dropoff_label: string;
  contact_name: string;
  contact_phone: string;
  note: string;
  vehicle_type: string;
  status: string;
  created_at?: string;
};

const tabs: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Vue globale' },
  { key: 'vtc', label: 'VTC' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'rental', label: 'Location' },
];

export default function OperatorPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [deliveryRequests, setDeliveryRequests] = useState<DeliveryOperatorRequest[]>([]);
  const [deliveryLoading, setDeliveryLoading] = useState<boolean>(true);

  const loadDeliveryRequests = async (): Promise<void> => {
    try {
      const { data } = await api.get<DeliveryOperatorRequest[]>('/delivery/operator-queue/');
      setDeliveryRequests(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      console.error('Operator delivery queue error', error);
      setDeliveryRequests([]);
    } finally {
      setDeliveryLoading(false);
    }
  };

  useEffect(() => {
    void loadDeliveryRequests();

    const interval = setInterval(() => {
      void loadDeliveryRequests();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const stats = useMemo<StatCard[]>(
    () => [
      {
        label: 'Demandes VTC en attente',
        value: 0,
        color: 'bg-orange-100 text-orange-700',
      },
      {
        label: 'Demandes Delivery opérateur',
        value: deliveryRequests.length,
        color: 'bg-red-100 text-red-700',
      },
      {
        label: 'Courses en cours',
        value: 0,
        color: 'bg-blue-100 text-blue-700',
      },
      {
        label: 'Incidents Location',
        value: 0,
        color: 'bg-purple-100 text-purple-700',
      },
    ],
    [deliveryRequests.length]
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
        >
            ← Retour au dashboard
        </Link>
      </div>  
      
      <div className="rounded-2xl bg-white shadow-sm border p-6">
        <h1 className="text-3xl font-bold text-gray-900">Operator Center</h1>
        <p className="text-gray-600 mt-2">
          Supervision temps réel des demandes VTC, Delivery et Location.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border bg-white p-5 shadow-sm"
          >
            <div className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${item.color}`}>
              {deliveryLoading && item.label === 'Demandes Delivery opérateur' ? '...' : item.value}
            </div>
            <p className="mt-3 text-sm text-gray-600">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-white border shadow-sm p-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'overview' && (
        <OverviewTab deliveryCount={deliveryRequests.length} />
      )}
      {activeTab === 'vtc' && <VtcTab />}
      {activeTab === 'delivery' && (
        <DeliveryTab
          requests={deliveryRequests}
          loading={deliveryLoading}
          onRefresh={loadDeliveryRequests}
        />
      )}
      {activeTab === 'rental' && <RentalTab />}
    </div>
  );
}

function OverviewTab({ deliveryCount }: { deliveryCount: number }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 rounded-2xl bg-white border shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Flux opérationnels</h2>

        <div className="space-y-4">
          <div className="rounded-xl border p-4">
            <h3 className="font-semibold text-gray-900">VTC</h3>
            <p className="text-sm text-gray-600 mt-1">
              Voir les demandes en attente, les courses sans chauffeur, les courses en cours et les blocages.
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <h3 className="font-semibold text-gray-900">Delivery</h3>
            <p className="text-sm text-gray-600 mt-1">
              Gérer les demandes operator_required, failed, les assignations manuelles et les suivis sensibles.
            </p>
            <p className="mt-2 text-sm font-semibold text-red-600">
              {deliveryCount} demande(s) nécessitent une attention opérateur.
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <h3 className="font-semibold text-gray-900">Location</h3>
            <p className="text-sm text-gray-600 mt-1">
              Superviser les réservations, incidents, indisponibilités véhicules et contacts propriétaires.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white border shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Priorités</h2>

        <div className="space-y-3 text-sm text-gray-600">
          <div className="rounded-xl bg-red-50 border border-red-100 p-4">
            Delivery operator_required / failed : {deliveryCount}
          </div>
          <div className="rounded-xl bg-orange-50 border border-orange-100 p-4">
            VTC sans chauffeur
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
            Courses en cours à surveiller
          </div>
        </div>
      </div>
    </div>
  );
}

function VtcTab() {
  return (
    <div className="rounded-2xl bg-white border shadow-sm p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Demandes VTC</h2>

      <p className="text-sm text-gray-500">
        Cette section affichera les demandes VTC en attente, les courses en cours
        et permettra d’assigner un chauffeur manuellement.
      </p>
    </div>
  );
}

type DeliveryTabProps = {
  requests: DeliveryOperatorRequest[];
  loading: boolean;
  onRefresh: () => Promise<void>;
};

function DeliveryTab({ requests, loading, onRefresh }: DeliveryTabProps) {
  const [selectedRequest, setSelectedRequest] = useState<DeliveryOperatorRequest | null>(null);

  useEffect(() => {
    if (!selectedRequest) return;

    const freshSelected = requests.find((request) => request.id === selectedRequest.id) || null;
    setSelectedRequest(freshSelected);
  }, [requests, selectedRequest]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 rounded-2xl bg-white border shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            Demandes Delivery opérateur
          </h2>

          <button
            onClick={() => void onRefresh()}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            Actualiser
          </button>
        </div>

        {loading && <p>Chargement...</p>}

        {!loading && (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left px-4 py-3">ID</th>
                  <th className="text-left px-4 py-3">Zones</th>
                  <th className="text-left px-4 py-3">Véhicule</th>
                  <th className="text-left px-4 py-3">Contact</th>
                  <th className="text-left px-4 py-3">Statut</th>
                  <th className="text-left px-4 py-3">Action</th>
                </tr>
              </thead>

              <tbody>
                {requests.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-gray-500" colSpan={6}>
                      Aucune demande en attente.
                    </td>
                  </tr>
                )}

                {requests.map((request) => (
                  <tr key={request.id} className="border-t">
                    <td className="px-4 py-3 font-semibold">{request.id}</td>

                    <td className="px-4 py-3">
                      {(request.pickup_zone || '—')} → {(request.dropoff_zone || '—')}
                    </td>

                    <td className="px-4 py-3">{request.vehicle_type}</td>

                    <td className="px-4 py-3">
                      {request.contact_name}
                      <br />
                      <span className="text-gray-500 text-xs">
                        {request.contact_phone}
                      </span>
                    </td>

                    <td className="px-4 py-3">{request.status}</td>

                    <td className="px-4 py-3">
                      <button
                        className="bg-blue-600 text-white px-3 py-1 rounded text-xs"
                        onClick={() => setSelectedRequest(request)}
                      >
                        Voir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white border shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Détail demande
        </h2>

        {!selectedRequest && (
          <div className="rounded-xl bg-gray-50 border border-dashed p-6 text-sm text-gray-500">
            Cliquez sur une demande pour afficher les détails,
            la carte et les actions opérateur.
          </div>
        )}

        {selectedRequest && (
          <div className="space-y-3 text-sm text-gray-700">
            <div><span className="font-semibold">ID :</span> {selectedRequest.id}</div>
            <div><span className="font-semibold">Type :</span> {selectedRequest.type}</div>
            <div>
              <span className="font-semibold">Zone récupération :</span> {selectedRequest.pickup_zone || '—'}
            </div>
            <div>
              <span className="font-semibold">Zone livraison :</span> {selectedRequest.dropoff_zone || '—'}
            </div>
            <div>
              <span className="font-semibold">Adresse départ :</span> {selectedRequest.pickup_label}
            </div>
            <div>
              <span className="font-semibold">Adresse arrivée :</span> {selectedRequest.dropoff_label}
            </div>
            <div>
              <span className="font-semibold">Contact :</span> {selectedRequest.contact_name} / {selectedRequest.contact_phone}
            </div>
            <div>
              <span className="font-semibold">Note :</span> {selectedRequest.note || '—'}
            </div>
            <div>
              <span className="font-semibold">Véhicule :</span> {selectedRequest.vehicle_type}
            </div>
            <div>
              <span className="font-semibold">Statut :</span> {selectedRequest.status}
            </div>

            <div className="pt-4 flex flex-wrap gap-2">
              <button className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                Prendre en charge
              </button>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                Assigner un livreur
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RentalTab() {
  return (
    <div className="rounded-2xl bg-white border shadow-sm p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Locations</h2>

      <p className="text-sm text-gray-500">
        Cette section permettra de superviser les réservations, les incidents
        et les contacts propriétaires.
      </p>
    </div>
  );
}