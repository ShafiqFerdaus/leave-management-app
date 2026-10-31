'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

    const { error } = await supabase.auth.signInWithPassword({
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
      {/* Original Dark Glassmorphism Container Card */}
      <div className="max-w-md w-full bg-slate-400/30 backdrop-blur-2xl rounded-3xl p-8 border border-white/40 shadow-2xl shadow-black/40 space-y-6">
        
        {/* Original HYDAC Red Pill Logo Header */}
        <div className="flex flex-col items-center space-y-2">
          <div className="bg-red-600 text-white font-black text-2xl tracking-wider px-7 py-2 rounded-2xl shadow-lg border border-red-500/50">
            HYDAC
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Sign In</h1>
          <p className="text-xs text-blue-900/80 font-medium">Access the HYDAC Leave Portal</p>
        </div>

        {/* Authentication Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">EMAIL</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="employee@hydac.com"
              className="w-full bg-white/70 border border-white/80 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-900"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-gray-700 uppercase">PASSWORD</label>
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
              className="w-full bg-white/70 border border-white/80 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-900"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-900 text-white font-semibold py-3 rounded-xl hover:bg-blue-800 transition shadow-lg shadow-blue-900/30 disabled:opacity-50 mt-2"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

      </div>
    </main>
  );
}