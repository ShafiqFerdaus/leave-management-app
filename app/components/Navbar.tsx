'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Retrieve current active session and register auth listener
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
      } else {
        setUser(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUser(session.user);
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success('Signed out successfully.');
    router.push('/login');
  };

  // Hide Navbar on authentication routes
  if (pathname === '/login' || pathname === '/register') {
    return null;
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Title */}
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/hydac-logo.png"
            alt="HYDAC Logo"
            className="h-8 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <span className="font-bold text-lg text-gray-900 hidden sm:inline">
            HYDAC Leave Portal
          </span>
        </Link>

        {/* Navigation Action Buttons */}
        {user && (
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition ${
                pathname === '/'
                  ? 'bg-blue-900 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Employee Portal
            </Link>

            <Link
              href="/manager"
              className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition ${
                pathname === '/manager'
                  ? 'bg-blue-900 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Manager Dashboard
            </Link>

            <Link
              href="/profile"
              className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition ${
                pathname === '/profile'
                  ? 'bg-blue-900 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Profile
            </Link>

            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}