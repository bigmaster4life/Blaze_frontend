'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardPage() {
  const { logout } = useAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Tableau de bord Blaze</h1>
        <button
          onClick={logout}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
        >
          Se déconnecter
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/operator"
          className="block border p-6 rounded-lg shadow hover:bg-gray-50 transition"
        >
          <h2 className="text-xl font-semibold mb-2">🎛️ Operator Center</h2>
          <p>Supervisez les demandes VTC, Delivery et Location en temps réel.</p>
        </Link>
        
        <Link
          href="/add-vehicle"
          className="block border p-6 rounded-lg shadow hover:bg-gray-50 transition"
        >
          <h2 className="text-xl font-semibold mb-2">🚘 Ajouter un véhicule</h2>
          <p>Ajoutez un véhicule à la plateforme Blaze.</p>
        </Link>

        <Link
          href="/drivers"
          className="block border p-6 rounded-lg shadow hover:bg-gray-50 transition"
        >
          <h2 className="text-xl font-semibold mb-2">🧑‍✈️ Chauffeurs</h2>
          <p>Gérez les chauffeurs enregistrés sur la plateforme.</p>
        </Link>

        <Link
          href="/delivery-drivers"
          className="block border p-6 rounded-lg shadow hover:bg-gray-50 transition"
        >
          <h2 className="text-xl font-semibold mb-2">🛵 Livreurs</h2>
          <p>Gérez les livreurs, leurs statuts et leurs disponibilités.</p>
        </Link>

        <Link
          href="/users"
          className="block border p-6 rounded-lg shadow hover:bg-gray-50 transition"
        >
          <h2 className="text-xl font-semibold mb-2">👤 Utilisateurs</h2>
          <p>Liste et gestion des utilisateurs Blaze.</p>
        </Link>

        <Link
          href="/settings"
          className="block border p-6 rounded-lg shadow hover:bg-gray-50 transition"
        >
          <h2 className="text-xl font-semibold mb-2">⚙️ Paramètres</h2>
          <p>Modifier les préférences ou les données générales.</p>
        </Link>

        <Link
          href="/analytics"
          className="block border p-6 rounded-lg shadow hover:bg-gray-50 transition"
        >
          <h2 className="text-xl font-semibold mb-2">📊 Analytique</h2>
          <p>{"Voir les statistiques d'utilisation et les données clés."}</p>
        </Link>
      </div>
    </div>
  );
}