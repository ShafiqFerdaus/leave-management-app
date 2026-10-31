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
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50/50">
      {/* Container Card */}
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-100 shadow-xl shadow-gray-200/50 space-y-6">
        
        {/* HYDAC Official Image Logo Header */}
        <div className="flex flex-col items-center space-y-2">
          <div className="relative w-48 h-14 flex items-center justify-center">
            <Image
              src="/hydac-logo.png"
              alt="HYDAC Logo"
              width={200}
              height={60}
              priority
              className="object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Sign In</h1>
          <p className="text-xs text-gray-500 font-medium">Access the HYDAC Leave Portal</p>
        </div>

        {/* Form Login */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="employee@hydac.com"
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent transition"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-600">Password</label>
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
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1b365d] text-white font-semibold py-3 rounded-xl hover:bg-blue-900 transition shadow-md shadow-blue-950/20 disabled:opacity-50 mt-2"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

      </div>
    </main>
  );
}