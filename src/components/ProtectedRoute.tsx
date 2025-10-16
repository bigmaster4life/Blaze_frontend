'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Ne rien faire tant que les infos de session ne sont pas chargées
    if (isLoading) return;

    // Si non connecté, rediriger
    if (!user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  // Afficher un loader pendant chargement ou pendant redirection
  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Chargement...
      </div>
    );
  }

  // Afficher la page protégée
  return <>{children}</>;
}