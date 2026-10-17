'use client';
import { useEffect, useState } from 'react';
import api, { apiErrorMessage } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';

type UserRow = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  user_type: string;
  date_joined?: string;
  is_active?: boolean;
};
type Directory = {
  count: number;
  next: string | null;
  previous: string | null;
  results: UserRow[];
};
const roleName: Record<string, string> = {
  manager_staff: 'Gestionnaire',
  employee_staff: 'Employé',
  client: 'Client',
  customer: 'Client',
  chauffeur: 'Chauffeur',
  driver: 'Chauffeur',
  delivery_driver: 'Livreur',
  loueur: 'Loueur',
};
const emptyForm = {
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  confirmation: '',
  user_type: 'employee_staff',
};
export default function UsersPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState<'team' | 'all'>('team');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<Directory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const canCreate =
    !!user &&
    (user.is_superuser ||
      (user.is_staff && user.user_type === 'manager_staff'));
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    api
      .get<Directory>('/users/', {
        params: { scope, search: query, page },
        signal: controller.signal,
      })
      .then((response) => {
        if (!controller.signal.aborted) {
          if (!response.data || !Array.isArray(response.data.results))
            throw new Error(
              'Le serveur doit être mis à jour pour afficher cet annuaire.'
            );
          setData(response.data);
        }
      })
      .catch((failure) => {
        if (!axios.isCancel(failure) && !controller.signal.aborted)
          setError(apiErrorMessage(failure));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [scope, query, page, attempt]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setFormError('');
    setSuccess('');
    if (form.password !== form.confirmation) {
      setFormError('Les mots de passe ne correspondent pas.');
      return;
    }
    setSaving(true);
    try {
      const { confirmation: _confirmation, ...payload } = form;
      void _confirmation;
      const response = await api.post<UserRow>('/users/staff/', payload);
      setSuccess(
        `Le compte de ${response.data.first_name} ${response.data.last_name} a été créé. Aucune invitation email n’a été envoyée.`
      );
      setForm(emptyForm);
      setCreating(false);
      setScope('team');
      setPage(1);
      setAttempt((value) => value + 1);
    } catch (failure) {
      setFormError(apiErrorMessage(failure));
    } finally {
      setSaving(false);
    }
  }
  const change = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) =>
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <span className="eyebrow">COMPTES ET ACCÈS</span>
          <h1>Utilisateurs</h1>
          <p>Retrouvez les comptes et gérez les accès de votre équipe.</p>
        </div>
        {canCreate && (
          <button
            className="button-primary"
            onClick={() => {
              setCreating(!creating);
              setFormError('');
            }}
          >
            {creating ? 'Fermer le formulaire' : '+ Créer un compte équipe'}
          </button>
        )}
      </header>
      {success && (
        <div role="status" className="notice-success">
          {success}
        </div>
      )}
      {creating && canCreate && (
        <section className="panel">
          <h2 className="text-lg font-semibold mb-2">
            Nouveau membre de l’équipe
          </h2>
          <p className="muted mb-6">
            Un accès personnel, avec un rôle adapté. Ce formulaire ne crée pas
            de compte client ni de chauffeur.
          </p>
          <form onSubmit={submit}>
            <div className="form-grid">
              <label>
                Prénom
                <input
                  name="first_name"
                  className="field-input"
                  value={form.first_name}
                  onChange={change}
                  required
                  maxLength={100}
                  autoComplete="given-name"
                />
              </label>
              <label>
                Nom
                <input
                  name="last_name"
                  className="field-input"
                  value={form.last_name}
                  onChange={change}
                  required
                  maxLength={100}
                  autoComplete="family-name"
                />
              </label>
              <label>
                Adresse email
                <input
                  name="email"
                  type="email"
                  className="field-input"
                  value={form.email}
                  onChange={change}
                  required
                  autoComplete="off"
                />
              </label>
              <label>
                Rôle
                <select
                  name="user_type"
                  className="field-input"
                  value={form.user_type}
                  onChange={change}
                >
                  <option value="employee_staff">Employé</option>
                  {user?.is_superuser && (
                    <option value="manager_staff">Gestionnaire</option>
                  )}
                </select>
              </label>
              <label>
                Mot de passe initial
                <input
                  name="password"
                  type="password"
                  className="field-input"
                  value={form.password}
                  onChange={change}
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </label>
              <label>
                Confirmer le mot de passe
                <input
                  name="confirmation"
                  type="password"
                  className="field-input"
                  value={form.confirmation}
                  onChange={change}
                  required
                  autoComplete="new-password"
                />
              </label>
            </div>
            {formError && (
              <div role="alert" className="notice-error mt-5">
                {formError}
              </div>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="button-quiet"
                onClick={() => {
                  setCreating(false);
                  setForm(emptyForm);
                }}
                disabled={saving}
              >
                Annuler
              </button>
              <button
                className="button-primary"
                type="submit"
                disabled={saving}
              >
                {saving ? 'Création en cours…' : 'Créer le compte'}
              </button>
            </div>
          </form>
        </section>
      )}
      <section className="panel page-stack">
        <div className="tabs" role="tablist" aria-label="Type de comptes">
          <button
            role="tab"
            aria-selected={scope === 'team'}
            onClick={() => {
              setScope('team');
              setPage(1);
            }}
          >
            Équipe
          </button>
          <button
            role="tab"
            aria-selected={scope === 'all'}
            onClick={() => {
              setScope('all');
              setPage(1);
            }}
          >
            Tous les utilisateurs
          </button>
        </div>
        <div className="toolbar">
          <input
            type="search"
            className="field-input"
            aria-label="Rechercher un utilisateur"
            placeholder="Rechercher un nom ou un email…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button
            className="button-quiet"
            disabled={loading}
            onClick={() => setAttempt((value) => value + 1)}
          >
            Actualiser
          </button>
          <span className="muted">
            {data ? `${data.count} compte${data.count > 1 ? 's' : ''}` : ''}
          </span>
        </div>
        {loading ? (
          <p role="status" className="muted">
            Chargement des comptes…
          </p>
        ) : error ? (
          <div role="alert" className="notice-error">
            {error}{' '}
            <button
              className="button-quiet"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Réessayer
            </button>
          </div>
        ) : !data?.results.length ? (
          <p className="muted">Aucun compte ne correspond à cette recherche.</p>
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Rôle</th>
                    <th>État</th>
                    <th>Créé le</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>
                          {row.first_name} {row.last_name}
                        </strong>
                      </td>
                      <td>{row.email}</td>
                      <td>{roleName[row.user_type] || row.user_type}</td>
                      <td>
                        <span className="pill">
                          {row.is_active === false ? 'Inactif' : 'Actif'}
                        </span>
                      </td>
                      <td>
                        {row.date_joined
                          ? new Date(row.date_joined).toLocaleDateString(
                              'fr-FR'
                            )
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="toolbar">
              <button
                className="button-quiet"
                disabled={!data.previous}
                onClick={() => setPage((value) => value - 1)}
              >
                Précédent
              </button>
              <span className="muted">Page {page}</span>
              <button
                className="button-quiet"
                disabled={!data.next}
                onClick={() => setPage((value) => value + 1)}
              >
                Suivant
              </button>
            </div>
          </>
        )}
        {!canCreate && (
          <p className="muted">
            La création des comptes d’équipe est réservée aux gestionnaires.
            Seul un administrateur peut créer un gestionnaire.
          </p>
        )}
      </section>
    </div>
  );
}
