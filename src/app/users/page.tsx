'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/utils/api';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

const ALLOWED_ROLES = ['manager_staff', 'employee_staff', 'loueur'];

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  user_type: string;
  created_at?: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const router = useRouter();

  // ----------------- VALIDATION DES ROLES -----------------
  useEffect(() => {
    if (!user) return;

    const role = user.user_type ?? '';

    if (!ALLOWED_ROLES.includes(role)) {
      router.push('/');
    }
  }, [user, router]);

  // ----------------- CHARGEMENT API -----------------
  const fetchUsers = async () => {
    try {
      const response = await api.get('/users/');

      // Format paginé ou liste simple
      const data = response.data;

      let finalUsers: User[] = [];

      if (Array.isArray(data)) {
        finalUsers = data;
      } else if (typeof data === 'object' && Array.isArray((data as PaginatedResponse<User>).results)) {
        finalUsers = (data as PaginatedResponse<User>).results;
      } else {
        throw new Error('Format API inattendu');
      }

      setUsers(finalUsers);
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

  // ----------------- RENDER -----------------
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
              {users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-2">
                    {u.first_name} {u.last_name}
                  </td>
                  <td className="p-2">{u.email}</td>
                  <td className="p-2 capitalize">{u.user_type}</td>
                  <td className="p-2">
                    {u.created_at
                      ? new Date(u.created_at).toLocaleDateString()
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