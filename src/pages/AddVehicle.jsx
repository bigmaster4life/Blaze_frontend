import React, { useState } from 'react';
import axios from 'axios';

const AddVehicle = () => {
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    transmission: '',
    fuel_type: '',
    seats: '',
    registration_number: '',
    daily_price: '',
    city: '',
    category: '',
    image: null,
  });

  const [message, setMessage] = useState('');
  const token = localStorage.getItem('token');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      image: e.target.files[0],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      data.append(key, value);
    });

    try {
      const response = await axios.post(
        'http://localhost:8000/api/vehicles/',
        data,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      setMessage('🚗 Véhicule ajouté avec succès !');
    } catch (error) {
      console.error(error);
      setMessage("❌ Une erreur s'est produite.");
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white shadow rounded mt-10">
      <h2 className="text-2xl font-bold mb-4">Ajouter un véhicule</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="brand" placeholder="Marque" onChange={handleChange} className="w-full border p-2" />
        <input name="model" placeholder="Modèle" onChange={handleChange} className="w-full border p-2" />
        
        <select name="transmission" onChange={handleChange} className="w-full border p-2">
          <option value="">Transmission</option>
          <option value="manual">Manuelle</option>
          <option value="automatic">Automatique</option>
        </select>

        <select name="fuel_type" onChange={handleChange} className="w-full border p-2">
          <option value="">Carburant</option>
          <option value="essence">Essence</option>
          <option value="diesel">Diesel</option>
          <option value="hybrid">Hybride</option>
          <option value="electric">Électrique</option>
        </select>

        <input name="seats" type="number" placeholder="Nombre de places" onChange={handleChange} className="w-full border p-2" />
        <input name="registration_number" placeholder="Immatriculation" onChange={handleChange} className="w-full border p-2" />
        <input name="daily_price" type="number" placeholder="Prix par jour" onChange={handleChange} className="w-full border p-2" />

        {/* 🆕 Ville */}
        <input name="city" placeholder="Ville (ex: Libreville)" onChange={handleChange} className="w-full border p-2" />

        {/* 🆕 Catégorie */}
        <select name="category" onChange={handleChange} className="w-full border p-2">
          <option value="">Catégorie</option>
          <option value="SUV">SUV</option>
          <option value="4x4">4x4</option>
          <option value="Berline">Berline</option>
          <option value="Citadine">Citadine</option>
        </select>

        <input name="image" type="file" accept="image/*" onChange={handleImageChange} className="w-full" />

        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Soumettre</button>
      </form>

      {message && <p className="mt-4 text-center">{message}</p>}
    </div>
  );
};

export default AddVehicle;