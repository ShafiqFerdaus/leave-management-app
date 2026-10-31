'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error('Login failed: ' + error.message);
      setLoading(false);
      return;
    }

    toast.success('Successfully logged in!');
    router.push('/');
    setLoading(false);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-transparent">
      <div className="max-w-md w-full bg-white/60 backdrop-blur-2xl rounded-3xl p-8 border border-white shadow-2xl space-y-6">
        {/* HYDAC Company Logo Header */}
        <div className="flex flex-col items-center space-y-2">
          <div className="bg-red-600 text-white font-black text-2xl tracking-wider px-6 py-2 rounded-xl shadow-md">
            HYDAC
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Sign In</h1>
          <p className="text-xs text-gray-500">Access the HYDAC Leave Portal</p>
        </div>

        {/* Authentication Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="employee@hydac.com"
              className="w-full bg-white/80 border border-white/90 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-600 uppercase">Password</label>
              <button
                type="button"
                onClick={() => router.push('/forgot-password')}
                className="text-xs font-semibold text-blue-900 hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/80 border border-white/90 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-900 text-white font-semibold py-3 rounded-xl hover:bg-blue-800 transition shadow-lg shadow-blue-900/20 disabled:opacity-50"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </div>
    </main>
  );
}