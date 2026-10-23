'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const sections = [
  ['/dashboard', 'Vue d’ensemble', 'VE'],
  ['/operator', 'Opérations', 'OP'],
  ['/restaurants', 'Restaurants & repas', 'RE'],
  ['/supervision', 'Supervision', 'SU'],
  ['/cancellation-alerts', 'Annulations à examiner', 'AL'],
  ['/drivers', 'Chauffeurs VTC', 'VT'],
  ['/delivery-drivers', 'Livreurs', 'LI'],
  ['/locations', 'Locations', 'LO'],
  ['/add-vehicle', 'Véhicules', 'VH'],
  ['/users', 'Utilisateurs', 'UT'],
  ['/analytics', 'Analyses', 'AN'],
  ['/ikassa', 'IKASSA', 'IK'],
  ['/settings', 'Paramètres', 'PA'],
];
const ownerPaths = ['/dashboard', '/locations', '/add-vehicle', '/settings'];
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, sessionError, retrySession, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const publicPage = pathname === '/' || pathname === '/login';
  const staff =
    !!user &&
    (user.is_staff ||
      user.is_superuser ||
      ['manager_staff', 'employee_staff'].includes(user.user_type || ''));
  const owner = user?.user_type === 'loueur';
  const permitted =
    staff ||
    (owner &&
      ownerPaths.some(
        (path) => pathname === path || pathname.startsWith(`${path}/`)
      ));
  useEffect(() => {
    if (!publicPage && !isLoading && !sessionError && !user)
      router.replace('/login');
  }, [publicPage, isLoading, sessionError, user, router]);
  if (publicPage) return <>{children}</>;
  if (isLoading)
    return (
      <div className="session-state" role="status">
        <div className="loader" />
        Vérification de votre session…
      </div>
    );
  if (sessionError)
    return (
      <div className="session-state">
        <h1>Connexion temporairement indisponible</h1>
        <p role="alert">{sessionError}</p>
        <button className="button-primary" onClick={() => void retrySession()}>
          Réessayer
        </button>
        <button className="button-quiet" onClick={logout}>
          Revenir à la connexion
        </button>
      </div>
    );
  if (!user)
    return (
      <div className="session-state" role="status">
        Redirection vers la connexion…
      </div>
    );
  if (!permitted)
    return (
      <div className="session-state">
        <h1>Accès réservé</h1>
        <p>Ce compte ne dispose pas des droits nécessaires pour cette page.</p>
        {owner && (
          <Link href="/dashboard" className="button-primary">
            Mon espace
          </Link>
        )}
        <button className="button-quiet" onClick={logout}>
          Se déconnecter
        </button>
      </div>
    );
  const navigation = sections.filter(
    ([path]) =>
      (staff || ownerPaths.includes(path)) &&
      (!['/supervision', '/cancellation-alerts', '/restaurants'].includes(path) ||
        user.is_superuser ||
        (user.is_staff && user.user_type === 'manager_staff'))
  );
  const title =
    navigation.find(
      ([path]) => pathname === path || pathname.startsWith(`${path}/`)
    )?.[1] || 'Espace de gestion';
  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <Link
          href="/dashboard"
          className="brand"
          onClick={() => setMenuOpen(false)}
        >
          <span className="brand-mark">B</span>
          <span>
            Blaze<span className="brand-subtitle">Espace de gestion</span>
          </span>
        </Link>
        <span className="nav-heading">ESPACE DE TRAVAIL</span>
        <nav aria-label="Navigation principale">
          {navigation.map(([path, label, icon]) => (
            <Link
              href={path}
              key={path}
              onClick={() => setMenuOpen(false)}
              aria-current={
                pathname === path || pathname.startsWith(`${path}/`)
                  ? 'page'
                  : undefined
              }
            >
              <span className="nav-icon" aria-hidden>
                {icon}
              </span>
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="status-dot" /> Gestion des opérations Be
        </div>
      </aside>
      {menuOpen && (
        <button
          className="mobile-overlay"
          aria-label="Fermer le menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div className="admin-workspace">
        <header className="admin-header">
          <div className="flex items-center gap-3">
            <button
              className="menu-toggle"
              aria-label="Ouvrir le menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              ☰
            </button>
            <span>{title}</span>
          </div>
          <div className="header-account">
            <span>
              <strong>
                {[user.first_name, user.last_name].filter(Boolean).join(' ') ||
                  user.email}
              </strong>
              <small>
                {user.is_superuser
                  ? 'Administrateur'
                  : user.user_type === 'manager_staff'
                  ? 'Gestionnaire'
                  : owner
                  ? 'Loueur'
                  : 'Employé'}
              </small>
            </span>
            <button className="button-quiet" onClick={logout}>
              Déconnexion
            </button>
          </div>
        </header>
        <main className="admin-main">{children}</main>
        <footer className="admin-footer">
          Blaze · Gestion et suivi des opérations
        </footer>
      </div>
    </div>
  );
}
