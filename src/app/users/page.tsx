'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/utils/api';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

// ✅ Rôles autorisés (déclaré en dehors du composant pour éviter le warning React)
const ALLOWED_ROLES = ['manager_staff'];

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  user_type: string;
  created_at?: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    if (!ALLOWED_ROLES.includes(user.user_type)) {
      router.push('/');
    }
  }, [user, router]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users/');
      setUsers(response.data);
    } catch {
      setError('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link
        href="/dashboard"
        className="mb-6 inline-block bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
      >
        ← Retour au tableau de bord
      </Link>

      <h1 className="text-3xl font-bold mb-6">Utilisateurs enregistrés</h1>

      {loading ? (
        <p>Chargement...</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : users.length === 0 ? (
        <p>Aucun utilisateur pour le moment.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border rounded text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Nom</th>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Rôle</th>
                <th className="p-2 text-left">{"Date d'inscription"}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t">
                  <td className="p-2">{user.first_name} {user.last_name}</td>
                  <td className="p-2">{user.email}</td>
                  <td className="p-2 capitalize">{user.user_type}</td>
                  <td className="p-2">
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString()
                      : 'Non spécifiée'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}