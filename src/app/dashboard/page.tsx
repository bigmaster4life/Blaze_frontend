'use client';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
const modules = [
  {
    href: '/operator',
    label: 'Opérations',
    tag: 'SUPERVISION',
    description:
      'Suivez les demandes et identifiez celles qui nécessitent une intervention.',
    action: 'Ouvrir les opérations',
  },
  {
    href: '/drivers',
    label: 'Chauffeurs VTC',
    tag: 'MOBILITÉ',
    description:
      'Invitez un chauffeur, vérifiez son dossier et gérez son accès.',
    action: 'Gérer les chauffeurs',
  },
  {
    href: '/delivery-drivers',
    label: 'Livreurs',
    tag: 'LIVRAISON',
    description:
      'Consultez les profils, les documents et la disponibilité des livreurs.',
    action: 'Gérer les livreurs',
  },
  {
    href: '/locations',
    label: 'Locations',
    tag: 'RÉSERVATIONS',
    description:
      'Retrouvez les réservations et les informations utiles à leur suivi.',
    action: 'Voir les locations',
  },
  {
    href: '/users',
    label: 'Utilisateurs et équipe',
    tag: 'ACCÈS',
    description:
      'Retrouvez les utilisateurs et créez les comptes de votre équipe selon vos droits.',
    action: 'Gérer les utilisateurs',
  },
  {
    href: '/analytics',
    label: 'Analyses',
    tag: 'ACTIVITÉ',
    description:
      'Consultez les indicateurs et les données disponibles pour la période choisie.',
    action: 'Consulter les analyses',
  },
];
export default function DashboardPage() {
  const { user } = useAuth();
  const owner =
    user?.user_type === 'loueur' && !user.is_staff && !user.is_superuser;
  return (
    <div className="page-stack">
      <section className="dashboard-welcome">
        <div>
          <span className="eyebrow">VOTRE ESPACE DE TRAVAIL</span>
          <h1>Bonjour{user?.first_name ? ` ${user.first_name}` : ''}.</h1>
          <p>
            Retrouvez vos outils de gestion et accédez directement à vos
            opérations.
          </p>
        </div>
        <Link
          className="button-primary"
          href={owner ? '/add-vehicle' : '/operator'}
        >
          {owner ? 'Ajouter un véhicule' : 'Voir les opérations'}{' '}
          <span aria-hidden>↗</span>
        </Link>
      </section>
      <div className="section-heading">
        <h2>Gérer l’activité</h2>
        <span>Choisissez un espace pour commencer</span>
      </div>
      <div className="module-grid">
        {modules
          .filter((module) => !owner || module.href === '/locations')
          .map((module) => (
            <Link href={module.href} key={module.href} className="module-card">
              <span className="eyebrow">{module.tag}</span>
              <h2>{module.label}</h2>
              <p>{module.description}</p>
              <span className="module-action">
                {module.action}
                <span aria-hidden>↗</span>
              </span>
            </Link>
          ))}
      </div>
      <section className="info-banner">
        <strong>Chaque membre de l’équipe utilise son propre accès.</strong>
        <p>
          La page Utilisateurs distingue les comptes enregistrés et la création
          de comptes d’équipe. Les droits de création sont réservés aux
          gestionnaires autorisés.
        </p>
      </section>
    </div>
  );
}
