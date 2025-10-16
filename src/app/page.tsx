'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const { user, logout, isLoading } = useAuth();

  if (isLoading) return null; // Important pour éviter les bugs pendant le chargement

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 relative">
      {/* Fond vidéo pour desktop */}
      <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0 hidden md:block">
        <source src="/videos/drive.mp4" type="video/mp4" />
      </video>

      {/* Image de fond pour mobile */}
      <Image
        src="/images/bg.jpg"
        alt="Blaze Background"
        layout="fill"
        objectFit="cover"
        className="block md:hidden z-0"
      />

      <div className="absolute inset-0 bg-black opacity-70 z-0" />

      {/* Contenu principal */}
      <div className="z-10 text-center space-y-6">
        <Image src="/logo-blaze.png" alt="Blaze Logo" width={200} height={200} />

        <h1 className="text-4xl font-bold">Bienvenue sur Blaze</h1>
        <p>Louez ou proposez votre véhicule facilement</p>

        <div className="space-x-4">
          {!user ? (
            <Link
              href="/login"
              className="bg-white text-black px-6 py-2 rounded shadow hover:bg-gray-200 transition"
            >
              Se connecter
            </Link>
          ) : (
            <>
              <Link
                href="/dashboard"
                className="bg-green-600 px-4 py-2 rounded hover:bg-green-700 transition"
              >
                Dashboard
              </Link>
              <button
                onClick={logout}
                className="bg-red-600 px-4 py-2 rounded hover:bg-red-700 transition"
              >
                Déconnexion
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}