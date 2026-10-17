'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
export default function Home() {
  const router = useRouter();
  const { user, isLoading, sessionError, retrySession, logout } = useAuth();
  useEffect(() => {
    if (!isLoading && !sessionError)
      router.replace(user ? '/dashboard' : '/login');
  }, [user, isLoading, sessionError, router]);
  return (
    <div className="session-state">
      {sessionError ? (
        <>
          <p role="alert">{sessionError}</p>
          <button
            className="button-primary"
            onClick={() => void retrySession()}
          >
            Réessayer
          </button>
          <button className="button-quiet" onClick={logout}>
            Se reconnecter
          </button>
        </>
      ) : (
        <>
          <div className="loader" />
          <p>Ouverture de votre espace…</p>
        </>
      )}
    </div>
  );
}
