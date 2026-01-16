// app/layout.tsx
import type { Metadata } from "next";
import Link from "next/link";
import "../globals.css";


export const metadata: Metadata = {
  title: "Blaze | Dashboard",
  description: "Plateforme de gestion des véhicules, chauffeurs et utilisateurs",
  icons: {
    icon: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png" },
      { url: "/apple-touch-icon-precomposed.png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-100 text-gray-800">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md p-4">
        <h1 className="text-2xl font-bold mb-6 text-blue-600">🚗 Blaze Admin</h1>
        <nav className="flex flex-col space-y-3">
          <Link href="/" className="hover:text-blue-600">🏠 Accueil</Link>
          <Link href="/add-vehicle" className="hover:text-blue-600">🚘 Ajouter un véhicule</Link>
          <Link href="/drivers" className="hover:text-blue-600">🧑‍✈️ Chauffeurs</Link>
          <Link href="/delivery-drivers" className="hover:text-blue-600">🛵 Livreurs</Link>
          <Link href="/locations" className="hover:text-blue-600">📍 Locations</Link>
          <Link href="/users" className="hover:text-blue-600">👤 Utilisateurs</Link>
          <Link href="/analytics" className="hover:text-blue-600">📊 Analytics</Link>

          {/* ---- IKASSA SECTION ADDED HERE ---- */}
          <Link href="/ikassa" className="hover:text-blue-600">🛒 IKASSA (B2B)</Link>
          {/* ------------------------------------ */}
          
          <Link href="/settings" className="hover:text-blue-600">⚙️ Paramètres</Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}