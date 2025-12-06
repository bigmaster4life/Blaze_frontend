export default function IkassaHome() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-white">IKASSA – Dashboard</h1>

      <p className="text-gray-300 mt-2">
        Bienvenue dans le module IKASSA.  
        Sélectionnez une section dans la barre latérale pour commencer.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="bg-[#0b203a] rounded-xl p-4 shadow">
          <h2 className="text-lg text-white font-semibold">Produits</h2>
          <p className="text-gray-400 text-sm">Gestion du catalogue grossiste.</p>
        </div>

        <div className="bg-[#0b203a] rounded-xl p-4 shadow">
          <h2 className="text-lg text-white font-semibold">Commandes</h2>
          <p className="text-gray-400 text-sm">Suivi des commandes boutiques.</p>
        </div>

        <div className="bg-[#0b203a] rounded-xl p-4 shadow">
          <h2 className="text-lg text-white font-semibold">Clients</h2>
          <p className="text-gray-400 text-sm">Gestion des boutiques et grossistes.</p>
        </div>
      </div>
    </div>
  );
}