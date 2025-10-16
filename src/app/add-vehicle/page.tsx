'use client';
export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import axios, { AxiosError } from 'axios';
import api from '@/utils/api';

type Vehicle = {
  id: number;
  brand: string;
  model: string;
  transmission: 'manual' | 'automatic';
  fuel_type: 'essence' | 'diesel' | 'hybrid' | 'electric';
  seats: number;
  registration_number: string;
  daily_price: number;
  image: string;
  city: string;
  category: 'SUV' | '4x4' | 'Berline' | 'Citadine';
};

type DRFError = {
  detail?: string;
  [field: string]: string | string[] | undefined;
};

function formatDRFError(data: unknown): string {
  if (typeof data === 'string') return data;
  const err = data as DRFError | undefined;
  if (!err) return 'Bad Request';
  if (err.detail) return String(err.detail);

  const lines: string[] = [];
  Object.entries(err).forEach(([key, val]) => {
    if (key === 'detail' || typeof val === 'undefined') return;
    if (Array.isArray(val)) lines.push(`${key}: ${val.join(', ')}`);
    else lines.push(`${key}: ${val}`);
  });
  return lines.length ? lines.join('\n') : 'Bad Request';
}

const AddVehiclePage: React.FC = () => {
  const [form, setForm] = useState({
    brand: '',
    model: '',
    transmission: 'manual' as Vehicle['transmission'],
    fuel_type: 'essence' as Vehicle['fuel_type'],
    seats: 4,
    registration_number: '',
    daily_price: '', // string au formulaire, converti à l’envoi
    city: '',
    category: '' as '' | Vehicle['category'],
  });

  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Nettoyage de l’URL de preview pour éviter les leaks
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        name === 'seats'
          ? Number(value)
          : (value as typeof prev[keyof typeof prev]),
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImage(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      // validations simples
      if (
        !form.brand ||
        !form.model ||
        !form.registration_number ||
        !form.daily_price ||
        !form.city ||
        !form.category
      ) {
        alert('Merci de remplir tous les champs requis.');
        return;
      }

      const priceNum = Number(form.daily_price);
      if (Number.isNaN(priceNum) || priceNum < 0) {
        alert('Le prix/jour doit être un nombre valide.');
        return;
      }

      const formData = new FormData();
      formData.append('brand', form.brand);
      formData.append('model', form.model);
      formData.append('transmission', form.transmission);
      formData.append('fuel_type', form.fuel_type);
      formData.append('seats', String(form.seats));
      formData.append('registration_number', form.registration_number);
      formData.append('daily_price', String(priceNum));
      formData.append('city', form.city);
      formData.append('category', form.category);
      if (image) formData.append('image', image);

      // ✅ pas de localStorage ici, l’intercepteur d’api.ts ajoute Authorization
      const { data } = await api.post<Vehicle>('vehicles/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setVehicles((prev) => [...prev, data]);
      setSuccess(true);

      // reset
      setForm({
        brand: '',
        model: '',
        transmission: 'manual',
        fuel_type: 'essence',
        seats: 4,
        registration_number: '',
        daily_price: '',
        city: '',
        category: '',
      });
      setImage(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    } catch (err: unknown) {
      let message = "Erreur lors de l'ajout du véhicule.";
      if (axios.isAxiosError(err)) {
        const ax = err as AxiosError<unknown>;
        message = formatDRFError(ax.response?.data) || message;
        console.error('❌ AddVehicle payload:', ax.response?.data);
      } else if (err instanceof Error) {
        message = err.message;
      }
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <button
        onClick={() => (window.location.href = '/dashboard')}
        className="mb-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm"
      >
        ← Retour au tableau de bord
      </button>

      <h1 className="text-3xl font-bold mb-6">Ajouter un véhicule</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            name="brand"
            value={form.brand}
            onChange={handleChange}
            placeholder="Marque"
            required
            className="input"
          />
          <input
            type="text"
            name="model"
            value={form.model}
            onChange={handleChange}
            placeholder="Modèle"
            required
            className="input"
          />
          <select
            name="transmission"
            value={form.transmission}
            onChange={handleChange}
            className="input"
          >
            <option value="manual">Manuelle</option>
            <option value="automatic">Automatique</option>
          </select>
          <select
            name="fuel_type"
            value={form.fuel_type}
            onChange={handleChange}
            className="input"
          >
            <option value="essence">Essence</option>
            <option value="diesel">Diesel</option>
            <option value="hybrid">Hybride</option>
            <option value="electric">Électrique</option>
          </select>
          <input
            type="number"
            name="seats"
            value={form.seats}
            onChange={handleChange}
            placeholder="Nombre de sièges"
            className="input"
            min={1}
          />
          <input
            type="text"
            name="registration_number"
            value={form.registration_number}
            onChange={handleChange}
            placeholder="Immatriculation"
            required
            className="input"
          />
          <input
            type="number"
            name="daily_price"
            value={form.daily_price}
            onChange={handleChange}
            placeholder="Prix / jour"
            required
            className="input"
            min={0}
            step="0.01"
          />
          <input
            type="text"
            name="city"
            value={form.city}
            onChange={handleChange}
            placeholder="Ville"
            required
            className="input"
          />
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            required
            className="input"
          >
            <option value="">Catégorie</option>
            <option value="SUV">SUV</option>
            <option value="4x4">4x4</option>
            <option value="Berline">Berline</option>
            <option value="Citadine">Citadine</option>
          </select>
        </div>

        <div>
          <label className="block font-medium">Image du véhicule</label>
          <input type="file" accept="image/*" onChange={handleImageChange} className="mt-2" />
          {previewUrl && (
            <Image
              src={previewUrl}
              alt="Aperçu"
              width={300}
              height={200}
              className="mt-4 rounded shadow"
            />
          )}
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Envoi...' : 'Ajouter le véhicule'}
        </button>

        {success && (
          <p className="text-green-600 font-medium mt-4">
            ✅ Véhicule ajouté avec succès !
          </p>
        )}
      </form>

      {vehicles.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold mb-2">Véhicules ajoutés :</h2>
          <ul className="space-y-2">
            {vehicles.map((v) => (
              <li key={v.id} className="border p-2 rounded">
                🚗 {v.brand} {v.model} — {v.city} ({v.category})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AddVehiclePage;