'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
export default function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (user && !isLoading) router.replace('/dashboard');
  }, [user, isLoading, router]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Connexion impossible. Réessayez.'
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-intro">
        <div className="brand">
          <span className="brand-mark">B</span>
          <span>Blaze</span>
        </div>
        <div>
          <span className="eyebrow">ESPACE ÉQUIPE</span>
          <h1>
            Vos opérations.
            <br />
            Une vue claire.
          </h1>
          <p>
            Coordonnez les trajets, les livraisons et les locations depuis votre
            espace de gestion.
          </p>
        </div>
        <small>Un accès personnel pour chaque membre de votre équipe.</small>
      </section>
      <section className="login-form-panel">
        <form onSubmit={submit} className="login-form">
          <span className="eyebrow">BONJOUR</span>
          <h2>Connexion à Blaze</h2>
          <p className="muted">
            Utilisez votre compte professionnel pour continuer.
          </p>
          <label htmlFor="email">Adresse email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="prenom@votreentreprise.com"
          />
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && (
            <div role="alert" className="notice-error">
              {error}
            </div>
          )}
          <button
            type="submit"
            className="button-primary"
            disabled={loading || isLoading}
          >
            {loading
              ? 'Connexion en cours…'
              : isLoading
              ? 'Vérification de la session…'
              : 'Se connecter'}
          </button>
          <p className="login-help">
            Vous n’avez pas de compte ? Contactez votre gestionnaire pour
            obtenir un accès.
          </p>
        </form>
      </section>
    </main>
  );
}
