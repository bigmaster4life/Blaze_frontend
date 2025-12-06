'use client';

import Link from 'next/link';

export default function IkassaHome() {
  return (
    <div className="p-6">

      {/* BOUTON RETOUR */}
      <Link
        href="/dashboard"
        className="mb-6 inline-block bg-gray-200 text-gray-900 px-4 py-2 rounded hover:bg-gray-300 transition"
      >
        ← Retour à Blaze
      </Link>

      {/* HEADER */}
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-[#0b203a] p-3 rounded-xl shadow-lg">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 3h18v4H3V3zm2 6h14v12H5V9z"
              stroke="#4ade80"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-white">IKASSA – Dashboard</h1>
          <p className="text-gray-300 mt-1 text-sm">
            Votre hub de gestion pour produits, commandes et clients.
          </p>
        </div>
      </div>

      {/* QUICK STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#0b203a] rounded-xl p-4 shadow hover:scale-[1.02] transition">
          <p className="text-gray-400 text-sm">Produits actifs</p>
          <h2 className="text-2xl font-bold text-green-400 mt-1">245</h2>
        </div>

        <div className="bg-[#0b203a] rounded-xl p-4 shadow hover:scale-[1.02] transition">
          <p className="text-gray-400 text-sm">Commandes du jour</p>
          <h2 className="text-2xl font-bold text-blue-400 mt-1">57</h2>
        </div>

        <div className="bg-[#0b203a] rounded-xl p-4 shadow hover:scale-[1.02] transition">
          <p className="text-gray-400 text-sm">Boutiques actives</p>
          <h2 className="text-2xl font-bold text-yellow-400 mt-1">128</h2>
        </div>
      </div>

      {/* MAIN CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* PRODUITS */}
        <div className="group bg-[#0b203a] rounded-2xl p-6 shadow hover:bg-[#102b4d] transition cursor-pointer">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-600/20 p-3 rounded-xl">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 7l9-4 9 4-9 4-9-4zm0 6l9 4 9-4m-9 4v6"
                  stroke="#60a5fa"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2 className="text-xl text-white font-semibold">Produits</h2>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Gérez le catalogue, les stocks, catégories et les prix.
          </p>
        </div>

        {/* COMMANDES */}
        <div className="group bg-[#0b203a] rounded-2xl p-6 shadow hover:bg-[#102b4d] transition cursor-pointer">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-green-600/20 p-3 rounded-xl">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 4h16v2H4V4zm2 4h12v12H6V8z"
                  stroke="#4ade80"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h2 className="text-xl text-white font-semibold">Commandes</h2>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Suivez les commandes en temps réel, paiements et statuts.
          </p>
        </div>

        {/* CLIENTS */}
        <div className="group bg-[#0b203a] rounded-2xl p-6 shadow hover:bg-[#102b4d] transition cursor-pointer">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-yellow-600/20 p-3 rounded-xl">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z"
                  stroke="#facc15"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h2 className="text-xl text-white font-semibold">Clients</h2>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Gérez les boutiques, profils, historiques et limites de crédit.
          </p>
        </div>

      </div>
    </div>
  );
}