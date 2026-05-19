import React, { useState } from 'react';
import { Employee } from '../types';

interface LoginProps {
  employees: Employee[];
  onLogin: (employee: Employee) => void;
}

export default function Login({ employees, onLogin }: LoginProps) {
  const [selectedUser, setSelectedUser] = useState<Employee | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (selectedUser.role === 'admin') {
      if (password === 'pitruski') {
        onLogin(selectedUser);
      } else {
        setError('Contraseña incorrecta');
      }
    } else {
      onLogin(selectedUser);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-[#2D5A27] py-10 flex flex-col items-center justify-center gap-4">
          <div className="bg-white p-3 rounded-full shadow-inner">
            <img src="/logo_tomate.svg" alt="Logo" className="w-20 h-20 object-contain drop-shadow-sm" referrerPolicy="no-referrer" />
          </div>
          <div className="text-center px-4">
            <h1 className="text-xl font-bold text-white tracking-tight leading-tight">El Cantó de la Bona Tomata</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider ml-1">
              ¿Quién eres?
            </label>
            <div className="grid grid-cols-2 gap-3">
              {employees.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => {
                    setSelectedUser(emp);
                    setError('');
                  }}
                  className={`py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                    selectedUser?.id === emp.id
                      ? 'bg-red-50 text-[#E23A2B] ring-2 ring-[#E23A2B]'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {emp.name}
                </button>
              ))}
            </div>
          </div>

          {selectedUser?.role === 'admin' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider ml-1">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa tu clave"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-[#E23A2B] outline-none transition-all"
              />
            </div>
          )}

          {error && (
            <p className="text-red-500 text-sm text-center font-medium animate-pulse">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!selectedUser || (selectedUser.role === 'admin' && !password)}
            className="w-full py-4 rounded-xl bg-[#E23A2B] text-white font-bold text-lg shadow-lg shadow-red-200 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
          >
            {selectedUser ? `Entrar como ${selectedUser.name}` : 'Selecciona tu nombre'}
          </button>
        </form>
      </div>
      
      <p className="mt-8 text-slate-400 text-sm font-medium">
        El Cantó de la Bona Tomata
      </p>
    </div>
  );
}
